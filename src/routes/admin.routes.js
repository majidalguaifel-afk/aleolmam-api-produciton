const router = require('express').Router();
const controller = require('../controllers/admin.controller');
const { requireJwt, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { adminCreateShipmentSchema, adminListShipmentsQuerySchema, carrierConfigSchema, carrierToggleSchema } = require('../validators/admin.validator');
const { createUserSchema } = require('../validators/auth.validator');

// كل مسارات لوحة التحكم تتطلب تسجيل دخول (JWT)
router.use(requireJwt);

/**
 * @openapi
 * /api/v1/admin/stats:
 *   get:
 *     summary: "[لوحة التحكم] إحصائيات عامة (عدد الشحنات، الحالات، آخر 7 أيام...)"
 *     tags: [Admin Dashboard]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: الإحصائيات }
 */
router.get('/stats', controller.stats);

/**
 * @openapi
 * /api/v1/admin/cash-collection:
 *   get:
 *     summary: "[لوحة التحكم] إجمالي الكاش المُحصَّل لكل مندوب في يوم معيّن"
 *     tags: [Admin Dashboard]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: "افتراضي: اليوم (بتوقيت الرياض)"
 *     responses:
 *       200: { description: القائمة }
 */
router.get('/cash-collection', controller.dailyCash);

/**
 * @openapi
 * /api/v1/admin/cash-collection/settle:
 *   post:
 *     summary: "[لوحة التحكم] تسجيل استلام المحاسبة لمبلغ مندوب في يوم معيّن"
 *     tags: [Admin Dashboard]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       201: { description: تم التسجيل }
 */
router.post('/cash-collection/settle', controller.settleCash);
router.post('/cash-collection/unsettle', controller.unsettleCash);

/**
 * @openapi
 * /api/v1/admin/shipments:
 *   get:
 *     summary: "[لوحة التحكم] كل الشحنات لجميع العملاء مع فلاتر (حالة، شركة شحن، عميل، بحث)"
 *     tags: [Admin Dashboard]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: القائمة }
 */
router.get('/shipments', validate({ query: adminListShipmentsQuerySchema }), controller.listShipments);

/**
 * @openapi
 * /api/v1/admin/shipments:
 *   post:
 *     summary: "[لوحة التحكم] إنشاء طلب شحن يدوياً نيابة عن عميل"
 *     tags: [Admin Dashboard]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       201: { description: تم الإنشاء }
 */
router.post('/shipments', validate({ body: adminCreateShipmentSchema }), controller.createShipment);
router.get('/shipments/:id', controller.getShipment);
router.post('/shipments/:id/cancel', controller.cancelShipment);
router.post('/shipments/:id/refresh-tracking', controller.refreshTracking);

router.get('/clients/:id/webhooks', controller.clientWebhooks);

/**
 * @openapi
 * /api/v1/admin/carriers:
 *   get:
 *     summary: "[لوحة التحكم] شركات الشحن وحالة الربط (بدون كشف الأسرار)"
 *     tags: [Admin Dashboard]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: القائمة }
 */
router.get('/carriers', controller.listCarriers);
router.put('/carriers/:code/config', requireRole('SUPER_ADMIN', 'ADMIN'), validate({ body: carrierConfigSchema }), controller.saveCarrierConfig);
router.post('/carriers/:code/toggle', requireRole('SUPER_ADMIN', 'ADMIN'), validate({ body: carrierToggleSchema }), controller.toggleCarrier);

// فريق العمل (مدير عام فقط)
router.get('/users', requireRole('SUPER_ADMIN'), controller.listUsers);
router.post('/users', requireRole('SUPER_ADMIN'), validate({ body: createUserSchema }), controller.createUser);
router.delete('/users/:id', requireRole('SUPER_ADMIN'), controller.deleteUser);

module.exports = router;
