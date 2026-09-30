const router = require('express').Router();
const controller = require('../controllers/customer.controller');
const { requireCustomerAuth } = require('../middleware/customerAuth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { requestCodeSchema, verifyCodeSchema } = require('../validators/customer.validator');

/**
 * @openapi
 * /api/v1/customer/request-code:
 *   post:
 *     summary: "[تطبيق العميل] طلب رمز تحقق يُرسَل للإيميل"
 *     tags: [Customer App]
 *     responses:
 *       200: { description: تم الإرسال }
 */
router.post('/request-code', authLimiter, validate({ body: requestCodeSchema }), controller.requestCode);

/**
 * @openapi
 * /api/v1/customer/verify-code:
 *   post:
 *     summary: "[تطبيق العميل] التحقق من الرمز والدخول (ينشئ الحساب أول مرة تلقائياً)"
 *     tags: [Customer App]
 *     responses:
 *       200: { description: تم الدخول }
 */
router.post('/verify-code', authLimiter, validate({ body: verifyCodeSchema }), controller.verifyCode);

router.use(requireCustomerAuth);
router.get('/me', controller.me);
router.get('/shipments', controller.listShipments);
router.get('/shipments/:id', controller.getShipment);

module.exports = router;
