require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const logger = require('./config/logger');
const swaggerSpec = require('./docs/swagger');
const { globalLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const shipmentsRoutes = require('./routes/shipments.routes');
const carriersRoutes = require('./routes/carriers.routes');
const webhooksRoutes = require('./routes/webhooks.routes');
const authRoutes = require('./routes/auth.routes');
const internalRoutes = require('./routes/internal.routes');
const publicRoutes = require('./routes/public.routes');
const customerRoutes = require('./routes/customer.routes');
const adminRoutes = require('./routes/admin.routes');
const setupRoutes = require('./routes/setup.routes');
const driverRoutes = require('./routes/driver.routes');

const app = express();

// خلف وسيط (Render / Nginx): لقراءة عنوان IP الحقيقي للزائر بشكل صحيح (مهم لتحديد معدل الطلبات)
app.set('trust proxy', 1);

// ---- أمان أساسي ----
app.use(helmet());
// المصادر المسموحة: موقعكم من .env + أصول تطبيقات الجوال الثابتة (Capacitor على iOS/Android)
// تطبيق المندوب يعتمد على مفتاح JWT في كل طلب (وليس كوكيز)، فتوسيع CORS له لا يفتح أي ثغرة —
// طلب بدون Origin (عملاء غير متصفح) أو من هذي الأصول يُقبل، وأي موقع متصفح آخر غير مذكور يُرفض تلقائياً.
const MOBILE_APP_ORIGINS = ['capacitor://localhost', 'ionic://localhost', 'http://localhost'];
const allowedOrigins = [...(process.env.CORS_ORIGINS || '').split(',').filter(Boolean), ...MOBILE_APP_ORIGINS];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('CORS: غير مسموح لهذا المصدر'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(globalLimiter);

// ---- فحص صحة الخادم (لمراقبة VPS / Load Balancer) ----
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ---- توثيق API التفاعلي ----
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'توثيق واجهة الإلمام للخدمات اللوجستية',
}));

// ---- المسارات الرئيسية ----
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/shipments', shipmentsRoutes);
app.use('/api/v1/carriers', carriersRoutes);
app.use('/api/v1/webhooks', webhooksRoutes);
app.use('/api/v1/internal', internalRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/customer', customerRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/setup', setupRoutes);
app.use('/api/v1/driver', driverRoutes);

// ---- لوحة التحكم (واجهة عربية سهلة) ----
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));

// الصفحة الرئيسية: المتصفح يُحوَّل للوحة التحكم، وبرامج الربط (API) تستلم JSON
app.get('/', (req, res) => {
  if (req.accepts(['html', 'json']) === 'html') return res.redirect('/admin/');
  res.json({ name: 'Al-Elmam Logistics API', status: 'running', admin: '/admin', docs: '/api-docs' });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
