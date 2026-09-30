const db = require('../config/db');
const { hashApiKey } = require('../utils/apiKey');
const asyncHandler = require('../utils/asyncHandler');

/**
 * يتحقق من مفتاح API في الترويسة: X-API-Key: <key>
 * كل عميل خارجي (تاجر، منصة، تطبيق) يستخدم هذا المفتاح للوصول لواجهة الشحنات.
 * يرفض الطلب لو المفتاح غير موجود أو العميل موقوف (SUSPENDED).
 */
const requireApiKey = asyncHandler(async (req, res, next) => {
  const key = req.headers['x-api-key'];

  if (!key) {
    return res.status(401).json({
      error: 'MISSING_API_KEY',
      message: 'مطلوب مفتاح API في الترويسة: X-API-Key',
    });
  }

  const hash = hashApiKey(key);
  const client = await db('clients').where({ api_key_hash: hash }).first();

  if (!client) {
    return res.status(401).json({ error: 'INVALID_API_KEY', message: 'مفتاح API غير صحيح' });
  }
  if (client.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'CLIENT_SUSPENDED', message: 'تم إيقاف هذا الحساب، تواصل مع الإلمام' });
  }

  req.client = client;
  next();
});

module.exports = { requireApiKey };
