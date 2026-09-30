const logger = require('../config/logger');

// خطأ مخصص يقدر أي جزء بالنظام يرميه بحالة HTTP واضحة
class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'NOT_FOUND', message: 'المسار المطلوب غير موجود' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} — ${err.message}\n${err.stack}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} — ${code}: ${err.message}`);
  }

  res.status(statusCode).json({
    error: code,
    message: statusCode >= 500 ? 'حدث خطأ داخلي في الخادم' : err.message,
    ...(process.env.NODE_ENV !== 'production' && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = { ApiError, notFoundHandler, errorHandler };
