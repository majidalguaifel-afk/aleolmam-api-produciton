const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const { requireJwt, requireRole } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { loginSchema, createClientSchema, changePasswordSchema } = require('../validators/auth.validator');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: تسجيل دخول لوحة إدارة الإلمام
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginRequest' }
 *     responses:
 *       200: { description: رمز الدخول (JWT) }
 *       401: { description: بيانات دخول خاطئة }
 */
router.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);

router.get('/me', requireJwt, asyncHandler(async (req, res) => {
  res.json({ data: await authService.getMe(req.user.id) });
}));
router.post('/change-password', requireJwt, authLimiter, validate({ body: changePasswordSchema }), asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
}));

// ---- مسارات إدارة عملاء API (Al-Elmam Admin only) ----
router.post('/admin/clients', requireJwt, requireRole('SUPER_ADMIN', 'ADMIN'), validate({ body: createClientSchema }), controller.createClient);
router.get('/admin/clients', requireJwt, requireRole('SUPER_ADMIN', 'ADMIN'), controller.listClients);
router.post('/admin/clients/:id/regenerate-key', requireJwt, requireRole('SUPER_ADMIN', 'ADMIN'), controller.regenerateKey);
router.post('/admin/clients/:id/suspend', requireJwt, requireRole('SUPER_ADMIN', 'ADMIN'), controller.suspendClient);
router.post('/admin/clients/:id/activate', requireJwt, requireRole('SUPER_ADMIN', 'ADMIN'), controller.activateClient);

module.exports = router;
