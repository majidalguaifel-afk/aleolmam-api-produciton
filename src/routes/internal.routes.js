const router = require('express').Router();
const controller = require('../controllers/dispatch.controller');
const { requireJwt } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createDriverSchema, assignDriverSchema, updateInternalStatusSchema } = require('../validators/dispatch.validator');

// كل مسارات هذا الملف خاصة بموظفي الإلمام (dispatch/إدارة) — تسجيل دخول JWT إلزامي
router.use(requireJwt);

/**
 * @openapi
 * /api/v1/internal/drivers:
 *   post:
 *     summary: "[إدارة الإلمام فقط] إضافة مندوب جديد للأسطول الداخلي"
 *     tags: [Internal Dispatch]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       201: { description: تم إنشاء المندوب }
 */
router.post('/drivers', validate({ body: createDriverSchema }), controller.createDriver);

/**
 * @openapi
 * /api/v1/internal/drivers:
 *   get:
 *     summary: "[إدارة الإلمام فقط] قائمة المناديب"
 *     tags: [Internal Dispatch]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: القائمة }
 */
router.get('/drivers', controller.listDrivers);
router.post('/drivers/:id/regenerate-pin', controller.regeneratePin);
router.post('/drivers/:id/deactivate', controller.deactivateDriver);
router.post('/drivers/:id/activate', controller.activateDriver);

/**
 * @openapi
 * /api/v1/internal/shipments:
 *   get:
 *     summary: "[إدارة الإلمام فقط] شحنات الأسطول الداخلي (الواردة من عملاء مثل أوتو)"
 *     tags: [Internal Dispatch]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: unassigned
 *         schema: { type: boolean }
 *         description: أظهر فقط الشحنات التي لم يُعيَّن لها مندوب بعد
 *     responses:
 *       200: { description: القائمة }
 */
router.get('/shipments', controller.listShipments);

/**
 * @openapi
 * /api/v1/internal/drivers-locations:
 *   get:
 *     summary: "[لوحة التحكم] آخر موقع معروف لكل مندوب نشط (للخريطة الحية)"
 *     tags: [Internal Dispatch]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: القائمة }
 */
router.get('/drivers-locations', controller.listLocations);

/**
 * @openapi
 * /api/v1/internal/shipments/{id}/assign:
 *   post:
 *     summary: "[إدارة الإلمام فقط] تعيين مندوب لشحنة"
 *     tags: [Internal Dispatch]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: تم التعيين }
 */
router.post('/shipments/:id/assign', validate({ body: assignDriverSchema }), controller.assignDriver);

/**
 * @openapi
 * /api/v1/internal/shipments/{id}/status:
 *   post:
 *     summary: "[إدارة الإلمام فقط] تحديث حالة شحنة داخلية يدوياً (استلام/توصيل/فشل...)"
 *     tags: [Internal Dispatch]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: تم التحديث، وتم إشعار العميل الأصلي عبر الويب هوك }
 */
router.post('/shipments/:id/status', validate({ body: updateInternalStatusSchema }), controller.updateStatus);

module.exports = router;
