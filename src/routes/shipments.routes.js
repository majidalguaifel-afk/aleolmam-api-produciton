const router = require('express').Router();
const controller = require('../controllers/shipments.controller');
const { requireApiKey } = require('../middleware/apiKeyAuth');
const { perClientLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const {
  createShipmentSchema,
  updateShipmentSchema,
  listShipmentsQuerySchema,
  idParamSchema,
} = require('../validators/shipment.validator');

router.use(requireApiKey, perClientLimiter);

/**
 * @openapi
 * /api/v1/shipments:
 *   post:
 *     summary: إنشاء طلب شحن جديد
 *     tags: [Shipments]
 *     security: [{ ApiKeyAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateShipmentRequest' }
 *     responses:
 *       201: { description: تم إنشاء الشحنة }
 *       422: { description: بيانات غير صحيحة }
 */
router.post('/', validate({ body: createShipmentSchema }), controller.create);

/**
 * @openapi
 * /api/v1/shipments:
 *   get:
 *     summary: قائمة شحنات العميل
 *     tags: [Shipments]
 *     security: [{ ApiKeyAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: قائمة الشحنات }
 */
router.get('/', validate({ query: listShipmentsQuerySchema }), controller.list);

/**
 * @openapi
 * /api/v1/shipments/{id}:
 *   get:
 *     summary: الاستعلام عن شحنة واحدة
 *     tags: [Shipments]
 *     security: [{ ApiKeyAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: بيانات الشحنة }
 *       404: { description: غير موجودة }
 */
router.get('/:id', validate({ params: idParamSchema }), controller.getOne);

/**
 * @openapi
 * /api/v1/shipments/{id}:
 *   patch:
 *     summary: تحديث بيانات شحنة
 *     tags: [Shipments]
 *     security: [{ ApiKeyAuth: [] }]
 *     responses:
 *       200: { description: تم التحديث }
 */
router.patch('/:id', validate({ params: idParamSchema, body: updateShipmentSchema }), controller.update);

/**
 * @openapi
 * /api/v1/shipments/{id}/cancel:
 *   post:
 *     summary: إلغاء طلب شحن
 *     tags: [Shipments]
 *     security: [{ ApiKeyAuth: [] }]
 *     responses:
 *       200: { description: تم الإلغاء }
 *       409: { description: لا يمكن الإلغاء في هذه الحالة }
 */
router.post('/:id/cancel', validate({ params: idParamSchema }), controller.cancel);

/**
 * @openapi
 * /api/v1/shipments/{id}/tracking:
 *   get:
 *     summary: سجل تتبع الشحنة الكامل
 *     tags: [Shipments]
 *     security: [{ ApiKeyAuth: [] }]
 *     responses:
 *       200: { description: أحداث التتبع }
 */
router.get('/:id/tracking', validate({ params: idParamSchema }), controller.tracking);

/**
 * @openapi
 * /api/v1/shipments/{id}/tracking/refresh:
 *   post:
 *     summary: استعلام مباشر من شركة الشحن عن آخر تحديث (بدلاً من انتظار الويب هوك)
 *     tags: [Shipments]
 *     security: [{ ApiKeyAuth: [] }]
 *     responses:
 *       200: { description: أحدث أحداث التتبع }
 */
router.post('/:id/tracking/refresh', validate({ params: idParamSchema }), controller.refreshTracking);

module.exports = router;
