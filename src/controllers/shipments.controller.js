const shipmentService = require('../services/shipment.service');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /api/v1/shipments
 * إنشاء طلب شحن جديد — يوجَّه تلقائياً لشركة الشحن المحددة عبر طبقة التجريد
 */
const create = asyncHandler(async (req, res) => {
  const { carrierCode, ...data } = req.body;
  const shipment = await shipmentService.createShipment({ clientId: req.client.id, carrierCode, data });
  res.status(201).json({ data: shipment });
});

/**
 * GET /api/v1/shipments/:id
 * الاستعلام عن شحنة واحدة
 */
const getOne = asyncHandler(async (req, res) => {
  const shipment = await shipmentService.getShipmentById(req.params.id, req.client.id);
  res.json({ data: shipment });
});

/**
 * GET /api/v1/shipments
 * قائمة شحنات العميل (مع فلترة وترقيم صفحات)
 */
const list = asyncHandler(async (req, res) => {
  const result = await shipmentService.listShipments({ clientId: req.client.id, ...req.query });
  res.json(result);
});

/**
 * PATCH /api/v1/shipments/:id
 * تحديث بيانات شحنة (الحقول المسموح تعديلها فقط، مثل بيانات المستلم قبل الاستلام)
 */
const update = asyncHandler(async (req, res) => {
  const shipment = await shipmentService.updateShipment(req.params.id, req.client.id, req.body);
  res.json({ data: shipment });
});

/**
 * POST /api/v1/shipments/:id/cancel
 * إلغاء طلب شحن
 */
const cancel = asyncHandler(async (req, res) => {
  const shipment = await shipmentService.cancelShipment(req.params.id, req.client.id);
  res.json({ data: shipment });
});

/**
 * GET /api/v1/shipments/:id/tracking
 * سجل التتبع الكامل للشحنة
 */
const tracking = asyncHandler(async (req, res) => {
  const events = await shipmentService.getTrackingHistory(req.params.id, req.client.id);
  res.json({ data: events });
});

/**
 * POST /api/v1/shipments/:id/tracking/refresh
 * يستعلم من شركة الشحن مباشرة عن آخر تحديث (بدلاً من انتظار الويب هوك)
 */
const refreshTracking = asyncHandler(async (req, res) => {
  const events = await shipmentService.refreshTracking(req.params.id, req.client.id);
  res.json({ data: events });
});

module.exports = { create, getOne, list, update, cancel, tracking, refreshTracking };
