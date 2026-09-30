const router = require('express').Router();
const controller = require('../controllers/public.controller');
const { publicTrackingLimiter } = require('../middleware/rateLimiter');

/**
 * @openapi
 * /api/v1/public/track/{reference}:
 *   get:
 *     summary: "[عام، بدون تسجيل دخول] تتبع شحنة برقم المرجع — لصفحة التتبع بالموقع الإلكتروني"
 *     tags: [Public Tracking]
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema: { type: string }
 *         example: ALM-7F3K9QX2
 *     responses:
 *       200: { description: بيانات التتبع (بدون عناوين أو أرقام جوال، لحماية الخصوصية) }
 *       404: { description: رقم الشحنة غير موجود }
 */
router.get('/track/:reference', publicTrackingLimiter, controller.track);

module.exports = router;
