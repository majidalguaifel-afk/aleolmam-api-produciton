const router = require('express').Router();
const controller = require('../controllers/driver.controller');
const { requireDriverAuth } = require('../middleware/driverAuth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { driverLoginSchema, driverStatusSchema, driverLocationSchema } = require('../validators/driver.validator');

/**
 * @openapi
 * /api/v1/driver/login:
 *   post:
 *     summary: "[تطبيق المندوب] تسجيل الدخول برقم الجوال ورمز PIN"
 *     tags: [Driver App]
 *     responses:
 *       200: { description: تم الدخول }
 */
router.post('/login', authLimiter, validate({ body: driverLoginSchema }), controller.login);

router.use(requireDriverAuth);
router.get('/me', controller.me);
router.get('/shipments', controller.listShipments);
router.get('/shipments/:id', controller.getShipment);
router.post('/shipments/:id/status', validate({ body: driverStatusSchema }), controller.updateStatus);

/**
 * @openapi
 * /api/v1/driver/location:
 *   post:
 *     summary: "[تطبيق المندوب] تحديث موقعه الحالي (يُرسل دورياً أثناء فتح التطبيق فقط)"
 *     tags: [Driver App]
 *     responses:
 *       200: { description: تم التحديث }
 */
router.post('/location', validate({ body: driverLocationSchema }), controller.updateLocation);

module.exports = router;
