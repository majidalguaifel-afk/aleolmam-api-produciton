const webhookService = require('../services/webhook.service');
const asyncHandler = require('../utils/asyncHandler');

/** POST /api/v1/webhooks — تسجيل رابط ويب هوك جديد لاستقبال تحديثات الشحنات لحظياً */
const register = asyncHandler(async (req, res) => {
  const webhook = await webhookService.registerWebhook(req.client.id, req.body);
  res.status(201).json({
    data: webhook,
    note: 'احتفظ بالـ secret في مكان آمن — يُستخدم للتحقق من توقيع الطلبات الواردة من الإلمام (HMAC-SHA256)',
  });
});

/** GET /api/v1/webhooks — قائمة الويب هوك المسجّلة لهذا العميل */
const list = asyncHandler(async (req, res) => {
  const webhooks = await webhookService.listWebhooks(req.client.id);
  res.json({ data: webhooks });
});

/** DELETE /api/v1/webhooks/:id */
const remove = asyncHandler(async (req, res) => {
  const deleted = await webhookService.deleteWebhook(req.client.id, req.params.id);
  if (!deleted) return res.status(404).json({ error: 'WEBHOOK_NOT_FOUND', message: 'الويب هوك غير موجود' });
  res.status(204).send();
});

module.exports = { register, list, remove };
