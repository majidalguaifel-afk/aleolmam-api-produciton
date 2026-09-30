const db = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

// الحالات المنتهية (لا تحتاج تصرف بعدها)
const FINAL_STATUSES = ['DELIVERED', 'CANCELLED', 'FAILED', 'RETURNED'];
const IN_TRANSIT_STATUSES = ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];

// حسب توقيت السعودية (وليس توقيت الخادم)
const TZ = 'Asia/Riyadh';

async function getStats() {
  const byStatusRows = await db('shipments').select('status').count('id as count').groupBy('status');
  const byStatus = {};
  let total = 0;
  for (const r of byStatusRows) {
    byStatus[r.status] = Number(r.count);
    total += Number(r.count);
  }

  const [{ count: today }] = await db('shipments')
    .whereRaw(`(created_at AT TIME ZONE ?)::date = (now() AT TIME ZONE ?)::date`, [TZ, TZ])
    .count('id as count');

  const [{ count: pendingDispatch }] = await db('shipments as s')
    .join('carriers as c', 's.carrier_id', 'c.id')
    .where('c.code', 'internal')
    .whereNull('s.assigned_driver_id')
    .whereNotIn('s.status', FINAL_STATUSES)
    .count('s.id as count');

  const last7Rows = await db('shipments')
    .select(db.raw(`to_char((created_at AT TIME ZONE ?)::date, 'YYYY-MM-DD') as day`, [TZ]))
    .count('id as count')
    .whereRaw(`(created_at AT TIME ZONE ?)::date >= ((now() AT TIME ZONE ?)::date - 6)`, [TZ, TZ])
    .groupBy('day')
    .orderBy('day', 'asc');
  const last7Map = Object.fromEntries(last7Rows.map((r) => [r.day, Number(r.count)]));
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000 + 3 * 3600000); // تقريب لتوقيت الرياض (UTC+3)
    const key = d.toISOString().slice(0, 10);
    last7.push({ day: key, count: last7Map[key] || 0 });
  }

  const byCarrier = await db('shipments as s')
    .join('carriers as c', 's.carrier_id', 'c.id')
    .select('c.code', 'c.name_ar as name')
    .count('s.id as count')
    .groupBy('c.code', 'c.name_ar')
    .orderBy('count', 'desc');

  const [{ count: clients }] = await db('clients').where({ status: 'ACTIVE' }).count('id as count');
  const [{ count: drivers }] = await db('drivers').where({ is_active: true }).count('id as count');

  const sum = (arr) => arr.reduce((a, k) => a + (byStatus[k] || 0), 0);
  return {
    totals: {
      all: total,
      today: Number(today),
      pendingDispatch: Number(pendingDispatch),
      inTransit: sum(IN_TRANSIT_STATUSES),
      newOrders: byStatus.CREATED || 0,
      delivered: byStatus.DELIVERED || 0,
      problems: sum(['FAILED', 'RETURNED']),
      cancelled: byStatus.CANCELLED || 0,
    },
    byStatus,
    byCarrier: byCarrier.map((r) => ({ code: r.code, name: r.name, count: Number(r.count) })),
    last7,
    clients: Number(clients),
    drivers: Number(drivers),
  };
}

async function listShipments({ status, carrier, clientId, driverId, q, assigned, active, page = 1, pageSize = 20 }) {
  const base = db('shipments as s')
    .join('carriers as c', 's.carrier_id', 'c.id')
    .join('clients as cl', 's.client_id', 'cl.id')
    .leftJoin('drivers as d', 's.assigned_driver_id', 'd.id');

  if (status) base.where('s.status', status);
  if (carrier) base.where('c.code', carrier);
  if (clientId) base.where('s.client_id', clientId);
  if (driverId) base.where('s.assigned_driver_id', driverId);
  if (assigned === 'no') base.whereNull('s.assigned_driver_id');
  if (assigned === 'yes') base.whereNotNull('s.assigned_driver_id');
  if (active === 'true') base.whereNotIn('s.status', FINAL_STATUSES);
  if (q) {
    const like = `%${q}%`;
    base.where((w) =>
      w.whereILike('s.reference', like)
        .orWhereILike('s.recipient_name', like)
        .orWhereILike('s.recipient_phone', like)
        .orWhereILike('s.sender_name', like)
        .orWhereILike('s.recipient_city', like)
        .orWhereILike('s.sender_city', like)
        .orWhereILike('s.carrier_shipment_id', like)
    );
  }

  const [{ count }] = await base.clone().count('s.id as count');
  const items = await base
    .clone()
    .select(
      's.id', 's.reference', 's.status', 's.carrier_shipment_id', 's.created_at', 's.updated_at',
      's.sender_name', 's.sender_city', 's.sender_address', 's.recipient_name', 's.recipient_phone', 's.recipient_city', 's.recipient_address',
      's.weight_kg', 's.cod_amount', 's.cost', 's.assigned_driver_id',
      'c.code as carrier_code', 'c.name_ar as carrier_name_ar',
      'cl.name as client_name', 'd.name as driver_name'
    )
    .orderBy('s.created_at', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total: Number(count), page: Number(page), pageSize: Number(pageSize) };
}

async function getShipmentDetail(id) {
  const shipment = await db('shipments as s')
    .join('carriers as c', 's.carrier_id', 'c.id')
    .join('clients as cl', 's.client_id', 'cl.id')
    .leftJoin('drivers as d', 's.assigned_driver_id', 'd.id')
    .select('s.*', 'c.code as carrier_code', 'c.name_ar as carrier_name_ar', 'cl.name as client_name', 'd.name as driver_name', 'd.phone as driver_phone')
    .where('s.id', id)
    .first();
  if (!shipment) throw new ApiError(404, 'SHIPMENT_NOT_FOUND', 'الشحنة غير موجودة');
  const events = await db('tracking_events').where({ shipment_id: id }).orderBy('occurred_at', 'asc');
  return { ...shipment, events };
}

async function listWebhooksForClient(clientId) {
  return db('webhooks').where({ client_id: clientId }).select('id', 'url', 'events', 'is_active', 'created_at');
}

/**
 * إجمالي الكاش (التحصيل عند الاستلام) لكل مندوب في يوم معيّن — بناءً على وقت تسجيل
 * حدث "تم التسليم" فعلياً (وليس آخر تعديل على الشحنة)، بتوقيت الرياض.
 */
async function _dailyTotalsRaw(day) {
  return db('tracking_events as te')
    .join('shipments as s', 's.id', 'te.shipment_id')
    .join('drivers as d', 'd.id', 's.assigned_driver_id')
    .where('te.status', 'DELIVERED')
    .whereRaw(`(te.occurred_at AT TIME ZONE ?)::date = ?::date`, [TZ, day])
    .whereNotNull('s.cod_amount')
    .where('s.cod_amount', '>', 0)
    .groupBy('d.id', 'd.name', 'd.phone')
    .select('d.id as driver_id', 'd.name as driver_name', 'd.phone as driver_phone')
    .count('s.id as delivered_count')
    .sum('s.cod_amount as total_cod')
    .orderBy('total_cod', 'desc');
}

async function getDailyCashCollection(dateStr) {
  const day = dateStr || new Date().toISOString().slice(0, 10);
  const rows = await _dailyTotalsRaw(day);
  const settlements = await db('cash_settlements').where({ settlement_date: day });
  const settledByDriver = Object.fromEntries(settlements.map((s) => [s.driver_id, s]));

  const totals = rows.reduce(
    (acc, r) => ({ deliveredCount: acc.deliveredCount + Number(r.delivered_count), totalCod: acc.totalCod + Number(r.total_cod) }),
    { deliveredCount: 0, totalCod: 0 }
  );
  const settledTotal = settlements.reduce((sum, s) => sum + Number(s.amount), 0);

  return {
    date: day,
    drivers: rows.map((r) => {
      const settlement = settledByDriver[r.driver_id];
      return {
        driverId: r.driver_id,
        driverName: r.driver_name,
        driverPhone: r.driver_phone,
        deliveredCount: Number(r.delivered_count),
        totalCod: Number(r.total_cod),
        settled: !!settlement,
        settledAt: settlement ? settlement.settled_at : null,
      };
    }),
    totals: { ...totals, settledTotal, remainingTotal: totals.totalCod - settledTotal },
  };
}

/** تسجيل استلام المحاسبة لمبلغ مندوب معيّن ليوم معيّن (يحسب المبلغ من واقع البيانات، لا يثق بأي رقم من الواجهة) */
async function settleDailyCash(driverId, dateStr, userId) {
  const day = dateStr || new Date().toISOString().slice(0, 10);
  const rows = await _dailyTotalsRaw(day);
  const row = rows.find((r) => r.driver_id === driverId);
  if (!row) throw new ApiError(404, 'NO_COLLECTION_FOUND', 'لا يوجد تحصيل مسجّل لهذا المندوب في هذا اليوم');

  const existing = await db('cash_settlements').where({ driver_id: driverId, settlement_date: day }).first();
  if (existing) throw new ApiError(409, 'ALREADY_SETTLED', 'تم تسجيل استلام هذا المبلغ مسبقاً');

  const { generateId } = require('../utils/id');
  await db('cash_settlements').insert({
    id: generateId('stl'),
    driver_id: driverId,
    settlement_date: day,
    amount: row.total_cod,
    settled_by_user_id: userId || null,
  });
  return { driverId, date: day, amount: Number(row.total_cod) };
}

/** تراجع عن تسجيل السداد (تصحيح خطأ إداري) */
async function unsettleDailyCash(driverId, dateStr) {
  const day = dateStr || new Date().toISOString().slice(0, 10);
  const deleted = await db('cash_settlements').where({ driver_id: driverId, settlement_date: day }).del();
  if (!deleted) throw new ApiError(404, 'NOT_SETTLED', 'لا يوجد سداد مسجّل لإلغائه');
}

module.exports = {
  getStats, listShipments, getShipmentDetail, listWebhooksForClient,
  getDailyCashCollection, settleDailyCash, unsettleDailyCash, FINAL_STATUSES,
};
