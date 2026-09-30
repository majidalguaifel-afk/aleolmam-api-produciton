const router = require('express').Router();
const controller = require('../controllers/carriers.controller');
const { requireApiKey } = require('../middleware/apiKeyAuth');

/**
 * @openapi
 * /api/v1/carriers:
 *   get:
 *     summary: قائمة شركات الشحن المفعّلة حالياً
 *     tags: [Carriers]
 *     security: [{ ApiKeyAuth: [] }]
 *     responses:
 *       200: { description: قائمة الشركات }
 */
router.get('/', requireApiKey, controller.list);

module.exports = router;
