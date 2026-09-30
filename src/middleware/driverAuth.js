const jwt = require('jsonwebtoken');

/** يتحقق من رمز JWT خاص بالمندوب (مختلف عن توكن لوحة الإدارة) */
const requireDriverAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'سجّل الدخول أولاً' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'driver') return res.status(401).json({ error: 'INVALID_TOKEN', message: 'رمز دخول غير صالح' });
    req.driverId = payload.driverId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'انتهت الجلسة، سجّل الدخول من جديد' });
  }
};
module.exports = { requireDriverAuth };
