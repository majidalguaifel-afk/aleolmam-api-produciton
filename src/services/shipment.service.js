const db = require('../config/db');
const { generateId } = require('../utils/id');
const { generateShipmentReference } = require('../utils/reference');
const { getAdapter } = require('../integrations/carrierFactory');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const { ApiError } = require('../middleware/errorHandler');
const webhookService = require('./webhook.service');
const logger = require('../config/logger');

const CACHE_TTL_SECONDS = 30;

/** يحوّل أخطاء الاتصال بشركات الشحن إلى رسالة عربية يفهمها موظف التشغيل (التفاصيل التقنية تبقى في السجل) */
function friendlyCarrierError(err) {
  const code = err.code;
  const status = err.response && err.response.status;
  if (err.statusCode === 424 || code === 'CARRIER_NOT_CONFIGURED') return err.message;
  if (['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN'].includes(code)) return 'تعذّر الوصول لخادم شركة الشحن — تأكد من "رابط الـ API" في إعدادات الشركة';
  if (['ETIMEDOUT', 'ECONNABORTED', 'ECONNRESET'].includes(code)) return 'انتهت مهلة الاتصال بشركة الشحن — حاول مرة أخرى بعد قليل';
  if (status === 401 || status === 403) return 'رفضت شركة الشحن بيانات الدخول — تأكد من اسم المستخدم/كلمة المرور/المفتاح في إعدادات الشركة';
  if (status === 404) return 'مسار الربط غير موجود عند شركة الشحن — يحتاج مراجعة فنّي مع التوثيق الرسمي للشركة';
  if (status >= 500) return 'خطأ من جهة شركة الشحن — حاول لاحقاً';
  return err.message;
}


/**
 * ينشئ شحنة جديدة: يسجّلها محلياً، ثم يرسلها لشركة الشحن المختارة عبر
 * طبقة التجريد (carrierFactory)، ثم يحدّث السجل بالنتيجة.
 */
async function createShipment({ clientId, carrierCode, data }) {
  const carrier = await db('carriers').where({ code: carrierCode, is_active: true }).first();
  if (!carrier) {
    throw new ApiError(400, 'CARRIER_NOT_FOUND', `شركة الشحن "${carrierCode}" غير مفعّلة أو غير موجودة`);
  }

  const id = generateId('shp');
  const reference = generateShipmentReference();

  const baseRecord = {
    id,
    reference,
    client_id: clientId,
    carrier_id: carrier.id,
    status: 'PENDING',
    sender_name: data.senderName,
    sender_phone: data.senderPhone,
    sender_address: data.senderAddress,
    sender_city: data.senderCity,
    recipient_name: data.recipientName,
    recipient_phone: data.recipientPhone,
    recipient_address: data.recipientAddress,
    recipient_city: data.recipientCity,
    weight_kg: data.weightKg,
    package_desc: data.packageDesc || null,
    cod_amount: data.codAmount || null,
    declared_value: data.declaredValue || null,
    currency: 'SAR',
    raw_request: JSON.stringify(data),
  };

  await db('shipments').insert(baseRecord);

  // محاولة الإرسال الفعلي لشركة الشحن
  try {
    const adapter = await getAdapter(carrierCode);
    const result = await adapter.createShipment(data);

    await db('shipments').where({ id }).update({
      status: 'CREATED',
      carrier_shipment_id: result.carrierShipmentId,
      cost: result.cost,
      currency: result.currency || 'SAR',
      raw_response: JSON.stringify(result.rawResponse || {}),
      updated_at: db.fn.now(),
    });

    await addTrackingEvent(id, {
      status: 'CREATED',
      description: 'Shipment created with carrier',
      descriptionAr: 'تم إنشاء الشحنة لدى شركة الشحن',
      source: 'system',
    });

    await webhookService.dispatchEvent(clientId, 'shipment.created', { shipmentId: id, reference, status: 'CREATED' });
  } catch (err) {
    // نسجّل الفشل لكن لا نفقد الطلب — يبقى بحالة PENDING/FAILED ليُعاد المحاولة لاحقاً
    logger.error(`فشل إرسال الشحنة ${reference} لشركة ${carrierCode}: ${err.message}`);
    const friendly = friendlyCarrierError(err);
    await db('shipments').where({ id }).update({
      status: 'FAILED',
      raw_response: JSON.stringify({ error: friendly, technical: err.message }),
      updated_at: db.fn.now(),
    });
    await addTrackingEvent(id, {
      status: 'FAILED',
      description: friendly,
      descriptionAr: 'تعذّر إنشاء الشحنة لدى شركة الشحن: ' + friendly,
      source: 'system',
    });
  }

  return getShipmentById(id, clientId);
}

async function getShipmentById(id, clientId) {
  const cacheKey = `shipment:${id}`;
  const cached = await cacheGet(cacheKey);
  if (cached && (!clientId || cached.client_id === clientId)) return cached;

  const query = db('shipments as s')
    .join('carriers as c', 's.carrier_id', 'c.id')
    .select('s.*', 'c.code as carrier_code', 'c.name_ar as carrier_name_ar')
    .where('s.id', id);
  if (clientId) query.andWhere('s.client_id', clientId);

  const shipment = await query.first();
  if (!shipment) throw new ApiError(404, 'SHIPMENT_NOT_FOUND', 'الشحنة غير موجودة');

  await cacheSet(cacheKey, shipment, CACHE_TTL_SECONDS);
  return shipment;
}

async function listShipments({ clientId, status, page = 1, pageSize = 20 }) {
  const query = db('shipments as s')
    .join('carriers as c', 's.carrier_id', 'c.id')
    .select('s.*', 'c.code as carrier_code', 'c.name_ar as carrier_name_ar')
    .where('s.client_id', clientId)
    .orderBy('s.created_at', 'desc');

  if (status) query.andWhere('s.status', status);

  const offset = (page - 1) * pageSize;
  const [{ count }] = await db('shipments').where({ client_id: clientId }).count('id as count');
  const items = await query.limit(pageSize).offset(offset);

  return { items, total: Number(count), page: Number(page), pageSize: Number(pageSize) };
}

async function updateShipment(id, clientId, updates) {
  const shipment = await getShipmentById(id, clientId);
  const allowed = ['recipient_name', 'recipient_phone', 'recipient_address', 'recipient_city', 'package_desc'];
  const patch = {};
  for (const key of allowed) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (updates[camelKey] !== undefined) patch[key] = updates[camelKey];
  }
  if (Object.keys(patch).length === 0) {
    throw new ApiError(422, 'NO_UPDATABLE_FIELDS', 'لا توجد حقول قابلة للتحديث في الطلب');
  }
  patch.updated_at = db.fn.now();
  await db('shipments').where({ id }).update(patch);
  await cacheDel(`shipment:${id}`);
  return getShipmentById(id, clientId);
}

async function cancelShipment(id, clientId) {
  const shipment = await getShipmentById(id, clientId);
  if (['DELIVERED', 'CANCELLED'].includes(shipment.status)) {
    throw new ApiError(409, 'CANNOT_CANCEL', `لا يمكن إلغاء شحنة بحالة ${shipment.status}`);
  }

  const carrier = await db('carriers').where({ id: shipment.carrier_id }).first();
  try {
    if (shipment.carrier_shipment_id) {
      const adapter = await getAdapter(carrier.code);
      await adapter.cancelShipment(shipment.carrier_shipment_id);
    }
  } catch (err) {
    logger.warn(`تعذّر إلغاء الشحنة لدى شركة الشحن (سيتم إلغاؤها محلياً فقط): ${err.message}`);
  }

  await db('shipments').where({ id }).update({ status: 'CANCELLED', updated_at: db.fn.now() });
  await addTrackingEvent(id, { status: 'CANCELLED', description: 'Shipment cancelled', descriptionAr: 'تم إلغاء الشحنة', source: 'system' });
  await cacheDel(`shipment:${id}`);
  await webhookService.dispatchEvent(clientId, 'shipment.cancelled', { shipmentId: id, reference: shipment.reference });

  return getShipmentById(id, clientId);
}

async function refreshTracking(id, clientId) {
  const shipment = await getShipmentById(id, clientId);
  const carrier = await db('carriers').where({ id: shipment.carrier_id }).first();
  if (carrier.code !== 'internal' && !shipment.carrier_shipment_id) {
    throw new ApiError(409, 'NOT_YET_CREATED', 'الشحنة لم تُرسل بعد لشركة الشحن، لا يوجد تتبع متاح');
  }
  const adapter = await getAdapter(carrier.code);
  const tracking = await adapter.getTracking({ carrierShipmentId: shipment.carrier_shipment_id, shipmentId: shipment.id });

  for (const event of tracking.events) {
    await addTrackingEvent(id, { ...event, source: 'carrier' }, true);
  }

  const newStatus = tracking.status;
  if (newStatus && newStatus !== shipment.status) {
    await db('shipments').where({ id }).update({ status: newStatus, updated_at: db.fn.now() });
    await cacheDel(`shipment:${id}`);
    await webhookService.dispatchEvent(clientId, 'shipment.status_changed', {
      shipmentId: id,
      reference: shipment.reference,
      previousStatus: shipment.status,
      newStatus,
    });
  }

  return getTrackingHistory(id, clientId);
}

async function addTrackingEvent(shipmentId, { status, description, descriptionAr, location, occurredAt, source }, skipIfDuplicate = false) {
  if (skipIfDuplicate) {
    const existing = await db('tracking_events')
      .where({ shipment_id: shipmentId, status, occurred_at: occurredAt })
      .first();
    if (existing) return;
  }
  await db('tracking_events').insert({
    id: generateId('evt'),
    shipment_id: shipmentId,
    status,
    description: description || null,
    description_ar: descriptionAr || null,
    location: location || null,
    occurred_at: occurredAt || db.fn.now(),
    source: source || 'carrier',
  });
}

async function getTrackingHistory(shipmentId, clientId) {
  await getShipmentById(shipmentId, clientId); // يتأكد من الملكية ويرمي 404 لو غير موجودة
  return db('tracking_events').where({ shipment_id: shipmentId }).orderBy('occurred_at', 'asc');
}

/** يقصّر الاسم لأول جزء منه فقط، حفاظاً على خصوصية أقل من اللازم لصفحة عامة بدون تسجيل دخول */
function maskName(fullName) {
  if (!fullName) return '';
  const first = String(fullName).trim().split(/\s+/)[0];
  return first + ' ***';
}

/**
 * تتبع عام بدون تسجيل دخول (لصفحة تتبع الموقع الإلكتروني) — يبحث برقم المرجع فقط.
 * يرجع الحد الأدنى اللازم لطمأنة العميل: الحالة والمدينتين والجدول الزمني،
 * بدون عناوين كاملة أو أرقام جوال أو مبلغ التحصيل (حماية خصوصية الطرفين).
 */
async function getPublicTracking(reference) {
  const shipment = await db('shipments')
    .where({ reference: String(reference).trim().toUpperCase() })
    .select('id', 'reference', 'status', 'sender_city', 'recipient_city', 'recipient_name', 'created_at')
    .first();
  if (!shipment) {
    const err = new Error('رقم الشحنة غير موجود — تأكد من الرقم وحاول مرة أخرى');
    err.statusCode = 404;
    err.code = 'REFERENCE_NOT_FOUND';
    throw err;
  }
  const events = await db('tracking_events')
    .where({ shipment_id: shipment.id })
    .orderBy('occurred_at', 'asc')
    .select('status', 'description_ar', 'description', 'occurred_at');

  return {
    reference: shipment.reference,
    status: shipment.status,
    senderCity: shipment.sender_city,
    recipientCity: shipment.recipient_city,
    recipientName: maskName(shipment.recipient_name),
    createdAt: shipment.created_at,
    events: events.map((e) => ({
      status: e.status,
      descriptionAr: e.description_ar || e.description,
      occurredAt: e.occurred_at,
    })),
  };
}

module.exports = {
  createShipment,
  getShipmentById,
  listShipments,
  updateShipment,
  cancelShipment,
  refreshTracking,
  getTrackingHistory,
  addTrackingEvent,
  getPublicTracking,
};
