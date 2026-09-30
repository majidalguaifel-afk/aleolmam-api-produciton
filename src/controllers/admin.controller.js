const asyncHandler = require('../utils/asyncHandler');
const db = require('../config/db');
const adminService = require('../services/admin.service');
const shipmentService = require('../services/shipment.service');
const authService = require('../services/auth.service');
const carrierConfig = require('../services/carrierConfig.service');
const { ApiError } = require('../middleware/errorHandler');

const stats = asyncHandler(async (req, res) => res.json({ data: await adminService.getStats() }));
const dailyCash = asyncHandler(async (req, res) => res.json({ data: await adminService.getDailyCashCollection(req.query.date) }));
const settleCash = asyncHandler(async (req, res) => {
  const result = await adminService.settleDailyCash(req.body.driverId, req.body.date, req.user.id);
  res.status(201).json({ data: result });
});
const unsettleCash = asyncHandler(async (req, res) => {
  await adminService.unsettleDailyCash(req.body.driverId, req.body.date);
  res.status(204).send();
});

const listShipments = asyncHandler(async (req, res) => res.json(await adminService.listShipments(req.query)));

const getShipment = asyncHandler(async (req, res) => res.json({ data: await adminService.getShipmentDetail(req.params.id) }));

/** إنشاء طلب يدوياً من اللوحة (مثلاً طلب وصل بالهاتف) نيابة عن عميل */
const createShipment = asyncHandler(async (req, res) => {
  const { clientId, carrierCode, ...data } = req.body;
  const client = await db('clients').where({ id: clientId }).first();
  if (!client) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'العميل غير موجود');
  if (client.status !== 'ACTIVE') throw new ApiError(403, 'CLIENT_NOT_ACTIVE', 'هذا العميل موقوف');
  const shipment = await shipmentService.createShipment({ clientId, carrierCode, data });
  res.status(201).json({ data: await adminService.getShipmentDetail(shipment.id) });
});

const cancelShipment = asyncHandler(async (req, res) => {
  const s = await db('shipments').where({ id: req.params.id }).first();
  if (!s) throw new ApiError(404, 'SHIPMENT_NOT_FOUND', 'الشحنة غير موجودة');
  await shipmentService.cancelShipment(s.id, s.client_id);
  res.json({ data: await adminService.getShipmentDetail(s.id) });
});

const refreshTracking = asyncHandler(async (req, res) => {
  const s = await db('shipments').where({ id: req.params.id }).first();
  if (!s) throw new ApiError(404, 'SHIPMENT_NOT_FOUND', 'الشحنة غير موجودة');
  await shipmentService.refreshTracking(s.id, s.client_id);
  res.json({ data: await adminService.getShipmentDetail(s.id) });
});

const clientWebhooks = asyncHandler(async (req, res) => res.json({ data: await adminService.listWebhooksForClient(req.params.id) }));

// ---- شركات الشحن ----
const listCarriers = asyncHandler(async (req, res) => res.json({ data: await carrierConfig.listCarriersAdmin() }));
const saveCarrierConfig = asyncHandler(async (req, res) => res.json({ data: await carrierConfig.saveConfig(req.params.code, req.body) }));
const toggleCarrier = asyncHandler(async (req, res) => res.json({ data: await carrierConfig.setActive(req.params.code, req.body.isActive) }));

// ---- المستخدمون (فريق العمل) ----
const listUsers = asyncHandler(async (req, res) => res.json({ data: await authService.listUsers() }));
const createUser = asyncHandler(async (req, res) => res.status(201).json({ data: await authService.createUser(req.body) }));
const deleteUser = asyncHandler(async (req, res) => {
  await authService.deleteUser(req.params.id, req.user.id);
  res.status(204).send();
});

module.exports = {
  stats, dailyCash, settleCash, unsettleCash, listShipments, getShipment, createShipment, cancelShipment, refreshTracking, clientWebhooks,
  listCarriers, saveCarrierConfig, toggleCarrier, listUsers, createUser, deleteUser,
};
