const asyncHandler = require('../utils/asyncHandler');
const driverAuth = require('../services/driverAuth.service');
const dispatchService = require('../services/dispatch.service');

const login = asyncHandler(async (req, res) => {
  const r = await driverAuth.login(req.body.phone, req.body.pin);
  res.json({ data: r });
});
const me = asyncHandler(async (req, res) => res.json({ data: await driverAuth.getMe(req.driverId) }));
const listShipments = asyncHandler(async (req, res) => {
  res.json({ data: await dispatchService.listDriverShipments(req.driverId, { active: req.query.active !== 'false' }) });
});
const getShipment = asyncHandler(async (req, res) => {
  res.json({ data: await dispatchService.getDriverShipment(req.driverId, req.params.id) });
});
const updateStatus = asyncHandler(async (req, res) => {
  await dispatchService.driverUpdateStatus(req.driverId, req.params.id, req.body);
  res.json({ data: await dispatchService.getDriverShipment(req.driverId, req.params.id) });
});
const updateLocation = asyncHandler(async (req, res) => {
  await dispatchService.updateDriverLocation(req.driverId, req.body.lat, req.body.lng);
  res.json({ ok: true });
});
module.exports = { login, me, listShipments, getShipment, updateStatus, updateLocation };
