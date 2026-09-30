const db = require('../config/db');
const { generateId } = require('../utils/id');
const { cacheDel } = require('../config/redis');
const { ApiError } = require('../middleware/errorHandler');
const { generatePin } = require('../utils/pin');
const shipmentService = require('./shipment.service');
const webhookService = require('./webhook.service');

/**
 * ============================================================================
 * خدمة الأسطول الداخلي (Internal Fleet / Dispatch Service)
 * ============================================================================
 * هذا الجزء يخدم السيناريو: شركة خارجية (مثال: "أوتو") تُنشئ شحنة عبر
 * واجهة الإلمام باختيار carrierCode = "internal"، فتقوم الإلمام بنفسها
 * (عبر مناديبها) بتوصيلها. هذه الدوال تُستخدم من لوحة إدارة الإلمام
 * (محمية بـ JWT، وليست جزءاً من API الذي يستخدمه العملاء الخارجيون).
 * ============================================================================
 */

async function createDriver({ name, phone, vehicleInfo }) {
  const existing = await db('drivers').where({ phone }).first();
  if (existing) throw new ApiError(409, 'PHONE_TAKEN', `رقم الجوال ${phone} مسجّل مسبقاً لمندوب آخر (${existing.name})`);
  const id = generateId('drv');
  const { pin, hash, prefix } = generatePin();
  await db('drivers').insert({ id, name, phone, vehicle_info: vehicleInfo || null, pin_hash: hash, pin_prefix: prefix });
  return { ...(await db('drivers').where({ id }).first()), pin }; // الرمز يُعرض مرة واحدة فقط هنا
}

async function regeneratePin(driverId) {
  const driver = await db('drivers').where({ id: driverId }).first();
  if (!driver) throw new ApiError(404, 'DRIVER_NOT_FOUND', 'المندوب غير موجود');
  const { pin, hash, prefix } = generatePin();
  await db('drivers').where({ id: driverId }).update({ pin_hash: hash, pin_prefix: prefix });
  return { pin, prefix };
}

async function listDrivers({ activeOnly = false } = {}) {
  const query = db('drivers as d')
    .select(
      'd.*',
      db.raw(`(SELECT COUNT(*) FROM shipments s WHERE s.assigned_driver_id = d.id AND s.status NOT IN ('DELIVERED','CANCELLED','FAILED','RETURNED'))::int AS active_shipments`),
      db.raw(`(SELECT COUNT(*) FROM shipments s WHERE s.assigned_driver_id = d.id AND s.status = 'DELIVERED')::int AS delivered_count`)
    )
    .orderBy('d.name');
  if (activeOnly) query.where('d.is_active', true);
  return query;
}

async function setDriverStatus(driverId, isActive) {
  const updated = await db('drivers').where({ id: driverId }).update({ is_active: isActive, updated_at: db.fn.now() });
  if (!updated) throw new ApiError(404, 'DRIVER_NOT_FOUND', 'المندوب غير موجود');
  return db('drivers').where({ id: driverId }).first();
}

/** يعرض شحنات الأسطول الداخلي فقط (carrier.code = internal)، مع خيار فلترة غير المُعيَّنة */
async function listInternalShipments({ unassignedOnly = false, driverId, status } = {}) {
  const query = db('shipments as s')
    .join('carriers as c', 's.carrier_id', 'c.id')
    .leftJoin('drivers as d', 's.assigned_driver_id', 'd.id')
    .select('s.*', 'd.name as driver_name', 'd.phone as driver_phone')
    .where('c.code', 'internal')
    .orderBy('s.created_at', 'desc');

  if (unassignedOnly) query.whereNull('s.assigned_driver_id');
  if (driverId) query.andWhere('s.assigned_driver_id', driverId);
  if (status) query.andWhere('s.status', status);

  return query;
}

/** يعيّن مندوباً لشحنة داخلية، ويحدّث حالتها إلى PICKED_UP تلقائياً (اختياري: تبقى CREATED لحين الاستلام الفعلي) */
async function assignDriver(shipmentId, driverId) {
  const shipment = await db('shipments').where({ id: shipmentId }).first();
  if (!shipment) throw new ApiError(404, 'SHIPMENT_NOT_FOUND', 'الشحنة غير موجودة');

  const driver = await db('drivers').where({ id: driverId, is_active: true }).first();
  if (!driver) throw new ApiError(404, 'DRIVER_NOT_FOUND', 'المندوب غير موجود أو غير مفعّل');

  await db('shipments').where({ id: shipmentId }).update({ assigned_driver_id: driverId, updated_at: db.fn.now() });
  await shipmentService.addTrackingEvent(shipmentId, {
    status: shipment.status,
    description: `Assigned to driver ${driver.name}`,
    descriptionAr: `تم تعيين المندوب ${driver.name} لهذه الشحنة`,
    source: 'system',
  });
  await cacheDel(`shipment:${shipmentId}`);

  return db('shipments').where({ id: shipmentId }).first();
}

/**
 * تحديث حالة شحنة داخلية يدوياً من طرف الإلمام (لأنه لا يوجد API خارجي يُستعلَم منه).
 * يُستخدم هذا مثلاً من تطبيق المندوب نفسه أو من لوحة الإدارة.
 */
function generateDeliveryCode() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4 أرقام
}

/**
 * تحديث حالة شحنة داخلية.
 * - عند الانتقال لـ OUT_FOR_DELIVERY: يولَّد كود تسليم تلقائياً (مرة واحدة فقط لكل شحنة).
 * - عند الانتقال لـ DELIVERED من تطبيق المندوب (opts.requireDeliveryCode=true): يُطلب
 *   الكود ويُتحقق منه قبل القبول — هذا يمنع المندوب من ادّعاء التسليم بدون تسليم فعلي،
 *   لأن الكود لا يظهر له أبداً، فقط للعميل عبر الإدارة.
 * - نداء الإدارة (بدون opts) يتجاوز هذا الشرط عمداً، ليبقى عندهم دائماً خيار حسم
 *   الحالات الاستثنائية (عميل ما يرد، خلاف، إلخ) بدون ما يتعطل العمل.
 */
async function updateInternalStatus(shipmentId, { status, description, descriptionAr, location, deliveryCode }, opts = {}) {
  const shipment = await db('shipments').where({ id: shipmentId }).first();
  if (!shipment) throw new ApiError(404, 'SHIPMENT_NOT_FOUND', 'الشحنة غير موجودة');

  const validStatuses = ['CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(422, 'INVALID_STATUS', `الحالة غير صحيحة. القيم المسموحة: ${validStatuses.join(', ')}`);
  }

  if (status === 'DELIVERED' && opts.requireDeliveryCode) {
    if (!shipment.delivery_code) {
      throw new ApiError(409, 'NO_DELIVERY_CODE', 'لم يُرسَل كود تسليم لهذه الشحنة بعد — تواصل مع الإدارة أولاً');
    }
    if (String(deliveryCode || '').trim() !== shipment.delivery_code) {
      throw new ApiError(400, 'WRONG_DELIVERY_CODE', 'كود التسليم غير صحيح — تأكد من الكود مع العميل');
    }
  }

  const patch = { status, updated_at: db.fn.now() };
  if (status === 'OUT_FOR_DELIVERY' && !shipment.delivery_code) {
    patch.delivery_code = generateDeliveryCode();
  }

  await db('shipments').where({ id: shipmentId }).update(patch);
  await shipmentService.addTrackingEvent(shipmentId, { status, description, descriptionAr, location, source: 'internal' });
  await cacheDel(`shipment:${shipmentId}`);

  // إشعار العميل الأصلي (مثال: "أوتو") عبر الويب هوك بأن حالة طلبه تغيّرت
  await webhookService.dispatchEvent(shipment.client_id, 'shipment.status_changed', {
    shipmentId,
    reference: shipment.reference,
    previousStatus: shipment.status,
    newStatus: status,
  });

  return db('shipments').where({ id: shipmentId }).first();
}


/** شحنات مندوب معيّن (لتطبيق المندوب) — active=true للنشطة فقط، وإلا يرجع الكل مرتبة الأحدث أولاً */
// أعمدة الشحنة الآمنة لإرجاعها لتطبيق المندوب — delivery_code مُستبعد عمداً وبشكل دائم
const DRIVER_SAFE_COLUMNS = [
  'id', 'reference', 'status', 'created_at', 'updated_at',
  'sender_name', 'sender_phone', 'sender_address', 'sender_city',
  'recipient_name', 'recipient_phone', 'recipient_address', 'recipient_city',
  'weight_kg', 'package_desc', 'cod_amount',
];

async function listDriverShipments(driverId, { active = true } = {}) {
  const q = db('shipments').where({ assigned_driver_id: driverId }).select(DRIVER_SAFE_COLUMNS);
  if (active) q.whereNotIn('status', ['DELIVERED', 'CANCELLED', 'FAILED', 'RETURNED']);
  return q.orderBy('created_at', 'desc');
}

async function getDriverShipment(driverId, shipmentId) {
  const s = await db('shipments').where({ id: shipmentId, assigned_driver_id: driverId }).select(DRIVER_SAFE_COLUMNS).first();
  if (!s) throw new ApiError(404, 'SHIPMENT_NOT_FOUND', 'الشحنة غير موجودة أو غير مُسندة لك');
  const events = await db('tracking_events').where({ shipment_id: shipmentId }).orderBy('occurred_at', 'asc');
  return { ...s, events };
}

/** تحديث حالة من المندوب نفسه (يتأكد إن الشحنة فعلاً مُسندة له قبل التحديث) */
async function driverUpdateStatus(driverId, shipmentId, payload) {
  const owned = await db('shipments').where({ id: shipmentId, assigned_driver_id: driverId }).first();
  if (!owned) throw new ApiError(404, 'SHIPMENT_NOT_FOUND', 'الشحنة غير موجودة أو غير مُسندة لك');
  return updateInternalStatus(shipmentId, payload, { requireDeliveryCode: true });
}


/** يحدّث آخر موقع معروف للمندوب (يُستدعى من تطبيق الجوال أثناء فتحه فقط) */
async function updateDriverLocation(driverId, lat, lng) {
  await db('drivers').where({ id: driverId }).update({ last_lat: lat, last_lng: lng, last_location_at: db.fn.now() });
}

/** كل المناديب النشطين مع آخر موقع معروف لهم (لخريطة التتبع الحية) */
async function listDriverLocations() {
  return db('drivers')
    .where({ is_active: true })
    .whereNotNull('last_lat')
    .select('id', 'name', 'phone', 'last_lat', 'last_lng', 'last_location_at');
}

module.exports = {
  createDriver,
  regeneratePin,
  listDrivers,
  setDriverStatus,
  listInternalShipments,
  assignDriver,
  updateInternalStatus,
  listDriverShipments,
  getDriverShipment,
  driverUpdateStatus,
  updateDriverLocation,
  listDriverLocations,
};
