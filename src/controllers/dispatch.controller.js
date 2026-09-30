const dispatchService = require('../services/dispatch.service');
const asyncHandler = require('../utils/asyncHandler');

const createDriver = asyncHandler(async (req, res) => {
  const driver = await dispatchService.createDriver(req.body);
  res.status(201).json({ data: driver, warning: 'رمز الدخول (pin) يظهر مرة واحدة فقط الآن — سلّمه للمندوب ثم لا يظهر مجدداً' });
});
const regeneratePin = asyncHandler(async (req, res) => {
  const r = await dispatchService.regeneratePin(req.params.id);
  res.json({ data: r, warning: 'الرمز القديم لم يعد صالحاً' });
});

const listDrivers = asyncHandler(async (req, res) => {
  const drivers = await dispatchService.listDrivers({ activeOnly: req.query.activeOnly === 'true' });
  res.json({ data: drivers });
});

const deactivateDriver = asyncHandler(async (req, res) => {
  const driver = await dispatchService.setDriverStatus(req.params.id, false);
  res.json({ data: driver });
});

const activateDriver = asyncHandler(async (req, res) => {
  const driver = await dispatchService.setDriverStatus(req.params.id, true);
  res.json({ data: driver });
});

const listShipments = asyncHandler(async (req, res) => {
  const shipments = await dispatchService.listInternalShipments({
    unassignedOnly: req.query.unassigned === 'true',
    driverId: req.query.driverId,
    status: req.query.status,
  });
  res.json({ data: shipments });
});

const assignDriver = asyncHandler(async (req, res) => {
  const shipment = await dispatchService.assignDriver(req.params.id, req.body.driverId);
  res.json({ data: shipment });
});

const updateStatus = asyncHandler(async (req, res) => {
  const shipment = await dispatchService.updateInternalStatus(req.params.id, req.body);
  res.json({ data: shipment });
});

const listLocations = asyncHandler(async (req, res) => {
  res.json({ data: await dispatchService.listDriverLocations() });
});
module.exports = { createDriver, regeneratePin, listDrivers, deactivateDriver, activateDriver, listShipments, assignDriver, updateStatus, listLocations };
