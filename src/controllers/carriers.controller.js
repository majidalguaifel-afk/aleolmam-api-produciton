const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

/** GET /api/v1/carriers — قائمة شركات الشحن المفعّلة في النظام */
const list = asyncHandler(async (req, res) => {
  const carriers = await db('carriers').where({ is_active: true }).select('code', 'name', 'name_ar');
  res.json({ data: carriers });
});

module.exports = { list };
