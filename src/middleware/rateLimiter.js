const rateLimit = require('express-rate-limit');

// حد عام لكل الطلبات (حماية أساسية على مستوى IP قبل حتى التحقق من مفتاح API)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة واحدة
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'عدد الطلبات كبير جداً، حاول بعد قليل' },
});

// حد أشد على مسارات تسجيل الدخول (منع محاولات التخمين)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true, // تُحسب المحاولات الفاشلة فقط، حتى لا يُحظر موظفون يشتركون بنفس الشبكة
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS', message: 'محاولات كثيرة جداً، حاول بعد 15 دقيقة' },
});

// حد مخصص لكل عميل حسب rate_limit المسجّل له في القاعدة (يُطبَّق بعد requireApiKey)
function perClientLimiter(req, res, next) {
  if (!req.client) return next();
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: req.client.rate_limit || 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: () => req.client.id,
    message: { error: 'CLIENT_RATE_LIMITED', message: 'تجاوزت الحد المسموح من الطلبات بالدقيقة لهذا الحساب' },
  });
  return limiter(req, res, next);
}

// حد مخصص لصفحة التتبع العامة (بدون تسجيل دخول) — أشد من الحد العام لمنع محاولات مسح أرقام الشحنات
const publicTrackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'محاولات كثيرة جداً، حاول بعد قليل' },
});

module.exports = { globalLimiter, authLimiter, perClientLimiter, publicTrackingLimiter };
