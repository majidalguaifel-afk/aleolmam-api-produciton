const asyncHandler = require('../utils/asyncHandler');
const customerAuth = require('../services/customerAuth.service');
const customerShipment = require('../services/customerShipment.service');

const requestCode = asyncHandler(async (req, res) => {
  const data = await customerAuth.requestCode(req.body.email, req.body.phone);
  res.json({ data });
});
const verifyCode = asyncHandler(async (req, res) => {
  const data = await customerAuth.verifyCode(req.body.email, req.body.code);
  res.json({ data });
});
const me = asyncHandler(async (req, res) => res.json({ data: await customerAuth.getMe(req.customerId) }));

const listShipments = asyncHandler(async (req, res) => {
  const customer = await customerAuth.getMe(req.customerId);
  const direction = req.query.direction === 'outgoing' ? 'outgoing' : 'incoming';
  res.json({ data: await customerShipment.listCustomerShipments(customer.phone, direction) });
});
const getShipment = asyncHandler(async (req, res) => {
  const customer = await customerAuth.getMe(req.customerId);
  res.json({ data: await customerShipment.getCustomerShipment(customer.phone, req.params.id) });
});

module.exports = { requestCode, verifyCode, me, listShipments, getShipment };
