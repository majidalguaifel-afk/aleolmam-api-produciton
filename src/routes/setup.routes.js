const crypto = require('crypto');
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { setupSchema } = require('../validators/auth.validator');
const { ApiError } = require('../middleware/errorHandler');

// مفتاح إعداد اختياري (SETUP_KEY في متغيرات البيئة): لو عُرّف، لا يمكن إنشاء أول مدير بدونه.
// مفيد لو النظام منشور على الإنترنت قبل أن تفتح لوحة التحكم لأول مرة.
const requiresKey = () => !!process.env.SETUP_KEY;
const keyMatches = (given) => {
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(String(process.env.SETUP_KEY)).digest();
  return crypto.timingSafeEqual(a, b);
};

/** هل النظام بحاجة لإعداد أولي (لا يوجد أي مدير بعد)؟ — تستخدمه شاشة الدخول */
router.get('/status', asyncHandler(async (req, res) => {
  const needsSetup = await authService.needsSetup();
  res.json({ needsSetup, requiresKey: needsSetup && requiresKey() });
}));

/** إنشاء أول مدير عام — يعمل فقط مرة واحدة طالما لا يوجد أي مستخدم */
router.post('/', authLimiter, validate({ body: setupSchema }), asyncHandler(async (req, res) => {
  if (requiresKey() && !keyMatches(req.body.setupKey)) {
    throw new ApiError(403, 'INVALID_SETUP_KEY', 'مفتاح الإعداد غير صحيح');
  }
  const { setupKey, ...data } = req.body;
  const result = await authService.firstTimeSetup(data);
  res.status(201).json({ data: result });
}));

module.exports = router;
