const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');

/**
 * يتحقق من رمز JWT في هيدر Authorization: Bearer <token>
 * يُستخدم لحماية مسارات لوحة تحكم الإلمام (الإدارة) — إنشاء عملاء، مراقبة كل الشحنات، إلخ.
 */
const requireJwt = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'مطلوب رمز دخول (JWT) في الترويسة: Authorization: Bearer <token>',
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // رموز تطبيقي المندوب والعميل لهما بنية مختلفة تماماً (type:'driver'/'customer') ويجب ألا تُقبل هنا إطلاقاً
    if (payload.type === 'driver' || payload.type === 'customer' || !payload.role) {
      return res.status(401).json({ error: 'INVALID_TOKEN', message: 'رمز الدخول غير صالح لهذه اللوحة' });
    }
    req.user = payload; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'رمز الدخول غير صالح أو منتهي' });
  }
};

/** يتحقق أن المستخدم صاحب صلاحية كافية (مثال: SUPER_ADMIN فقط يقدر يدير المستخدمين الآخرين) */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'لا تملك صلاحية كافية لهذا الإجراء' });
  }
  next();
};

module.exports = { requireJwt, requireRole };
