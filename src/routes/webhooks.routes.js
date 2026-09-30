const router = require('express').Router();
const controller = require('../controllers/webhooks.controller');
const { requireApiKey } = require('../middleware/apiKeyAuth');
const validate = require('../middleware/validate');
const { registerWebhookSchema } = require('../validators/auth.validator');

router.use(requireApiKey);

/**
 * @openapi
 * /api/v1/webhooks:
 *   post:
 *     summary: تسجيل رابط ويب هوك لاستقبال إشعارات لحظية بتحديثات الشحنات
 *     tags: [Webhooks]
 *     security: [{ ApiKeyAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterWebhookRequest' }
 *     responses:
 *       201: { description: تم التسجيل }
 */
router.post('/', validate({ body: registerWebhookSchema }), controller.register);

/**
 * @openapi
 * /api/v1/webhooks:
 *   get:
 *     summary: قائمة الويب هوك المسجّلة
 *     tags: [Webhooks]
 *     security: [{ ApiKeyAuth: [] }]
 *     responses:
 *       200: { description: القائمة }
 */
router.get('/', controller.list);

/**
 * @openapi
 * /api/v1/webhooks/{id}:
 *   delete:
 *     summary: حذف ويب هوك
 *     tags: [Webhooks]
 *     security: [{ ApiKeyAuth: [] }]
 *     responses:
 *       204: { description: تم الحذف }
 */
router.delete('/:id', controller.remove);

module.exports = router;
