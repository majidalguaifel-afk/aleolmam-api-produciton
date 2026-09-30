const asyncHandler = require('../utils/asyncHandler');
const shipmentService = require('../services/shipment.service');

const track = asyncHandler(async (req, res) => {
  const data = await shipmentService.getPublicTracking(req.params.reference);
  res.json({ data });
});

module.exports = { track };
