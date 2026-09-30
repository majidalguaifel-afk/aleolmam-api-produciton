const app = require('./app');
const logger = require('./config/logger');
const { bootstrap } = require('./bootstrap');

const PORT = process.env.PORT || 4000;

let server;

(async () => {
  try {
    await bootstrap(); // إنشاء/تحديث الجداول وشركات الشحن تلقائياً
  } catch (err) {
    logger.error(`❌ فشل تهيئة قاعدة البيانات: ${err.message}`);
    process.exit(1);
  }
  server = app.listen(PORT, () => {
    logger.info(`🚀 Al-Elmam Logistics API يعمل الآن على المنفذ ${PORT}`);
    logger.info(`🖥️  لوحة التحكم: http://localhost:${PORT}/admin`);
    logger.info(`📖 التوثيق التفاعلي: http://localhost:${PORT}/api-docs`);
  });
})();

// إغلاق آمن عند إيقاف الخدمة (مهم عند استخدام PM2 على الـ VPS)
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server gracefully...');
  (server ? server.close(() => process.exit(0)) : process.exit(0));
});
process.on('SIGINT', () => {
  logger.info('SIGINT received, closing server gracefully...');
  (server ? server.close(() => process.exit(0)) : process.exit(0));
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});
