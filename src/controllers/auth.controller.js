const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');

/** POST /api/v1/auth/login — تسجيل دخول لوحة إدارة الإلمام */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.json({ data: result });
});

/** POST /api/v1/admin/clients — إنشاء عميل API جديد (تاجر/منصة تستخدم واجهة الإلمام) */
const createClient = asyncHandler(async (req, res) => {
  const client = await authService.createClient(req.body);
  res.status(201).json({
    data: client,
    warning: 'هذا المفتاح يُعرض مرة واحدة فقط ولن تتمكن من استرجاعه لاحقاً — احفظه الآن في مكان آمن',
  });
});

/** GET /api/v1/admin/clients — قائمة كل عملاء API */
const listClients = asyncHandler(async (req, res) => {
  const clients = await authService.listClients();
  res.json({ data: clients });
});

/** POST /api/v1/admin/clients/:id/regenerate-key — توليد مفتاح API جديد (يُبطل القديم فوراً) */
const regenerateKey = asyncHandler(async (req, res) => {
  const result = await authService.regenerateApiKey(req.params.id);
  res.json({ data: result, warning: 'المفتاح القديم لم يعد صالحاً بعد الآن' });
});

/** POST /api/v1/admin/clients/:id/suspend — إيقاف عميل مؤقتاً */
const suspendClient = asyncHandler(async (req, res) => {
  const client = await authService.setClientStatus(req.params.id, 'SUSPENDED');
  res.json({ data: client });
});

/** POST /api/v1/admin/clients/:id/activate — إعادة تفعيل عميل */
const activateClient = asyncHandler(async (req, res) => {
  const client = await authService.setClientStatus(req.params.id, 'ACTIVE');
  res.json({ data: client });
});

module.exports = { login, createClient, listClients, regenerateKey, suspendClient, activateClient };
