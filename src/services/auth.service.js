const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { generateId } = require('../utils/id');
const { generateApiKey } = require('../utils/apiKey');
const { ApiError } = require('../middleware/errorHandler');

async function login(email, password) {
  const user = await db('users').where({ email }).first();
  if (!user) throw new ApiError(401, 'INVALID_CREDENTIALS', 'البريد الإلكتروني أو كلمة المرور غير صحيحة');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'البريد الإلكتروني أو كلمة المرور غير صحيحة');

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  // تنبيه أمني: لو المدير ما زال يستخدم كلمة المرور الافتراضية المعروفة، نطلب منه تغييرها فوراً
  const defaultPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const mustChangePassword = password === defaultPassword;

  return { token, mustChangePassword, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

async function createUser({ name, email, password, role = 'ADMIN' }) {
  const existing = await db('users').where({ email }).first();
  if (existing) throw new ApiError(409, 'EMAIL_TAKEN', 'البريد الإلكتروني مستخدم بالفعل');

  const passwordHash = await bcrypt.hash(password, 10);
  const id = generateId('usr');
  await db('users').insert({ id, name, email, password_hash: passwordHash, role });
  return { id, name, email, role };
}

/** ينشئ عميل API جديد ويرجع المفتاح الفعلي مرة واحدة فقط */
async function createClient({ name, contactEmail, contactPhone, rateLimit = 100 }) {
  const { fullKey, hash, prefix } = generateApiKey('live');
  const id = generateId('cli');

  await db('clients').insert({
    id,
    name,
    contact_email: contactEmail,
    contact_phone: contactPhone || null,
    api_key_hash: hash,
    api_key_prefix: prefix,
    rate_limit: rateLimit,
  });

  return {
    id,
    name,
    contactEmail,
    apiKey: fullKey, // ⚠️ يُعرض هذا مرة واحدة فقط — لا يُخزَّن بالنظام بنص صريح أبداً
    apiKeyPrefix: prefix,
  };
}

async function regenerateApiKey(clientId) {
  const client = await db('clients').where({ id: clientId }).first();
  if (!client) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'العميل غير موجود');

  const { fullKey, hash, prefix } = generateApiKey('live');
  await db('clients').where({ id: clientId }).update({ api_key_hash: hash, api_key_prefix: prefix, updated_at: db.fn.now() });
  return { apiKey: fullKey, apiKeyPrefix: prefix };
}

async function listClients() {
  return db('clients as c')
    .select(
      'c.id', 'c.name', 'c.contact_email', 'c.contact_phone', 'c.api_key_prefix', 'c.status', 'c.rate_limit', 'c.created_at',
      db.raw('(SELECT COUNT(*) FROM shipments s WHERE s.client_id = c.id)::int AS shipments_count'),
      db.raw('(SELECT COUNT(*) FROM webhooks w WHERE w.client_id = c.id AND w.is_active = true)::int AS webhooks_count')
    )
    .orderBy('c.created_at', 'desc');
}

async function setClientStatus(clientId, status) {
  const updated = await db('clients').where({ id: clientId }).update({ status, updated_at: db.fn.now() });
  if (!updated) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'العميل غير موجود');
  return db('clients').where({ id: clientId }).first();
}


async function getMe(userId) {
  const user = await db('users').where({ id: userId }).first();
  if (!user) throw new ApiError(401, 'USER_NOT_FOUND', 'الحساب غير موجود');
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await db('users').where({ id: userId }).first();
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'الحساب غير موجود');
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) throw new ApiError(400, 'WRONG_PASSWORD', 'كلمة المرور الحالية غير صحيحة');
  if (newPassword === currentPassword) throw new ApiError(400, 'SAME_PASSWORD', 'كلمة المرور الجديدة يجب أن تختلف عن الحالية');
  const hash = await bcrypt.hash(newPassword, 10);
  await db('users').where({ id: userId }).update({ password_hash: hash, updated_at: db.fn.now() });
}

async function listUsers() {
  return db('users').select('id', 'name', 'email', 'role', 'created_at').orderBy('created_at', 'asc');
}

async function deleteUser(targetId, actorId) {
  if (targetId === actorId) throw new ApiError(400, 'CANNOT_DELETE_SELF', 'لا يمكنك حذف حسابك الحالي');
  const target = await db('users').where({ id: targetId }).first();
  if (!target) throw new ApiError(404, 'USER_NOT_FOUND', 'المستخدم غير موجود');
  if (target.role === 'SUPER_ADMIN') {
    const [{ count }] = await db('users').where({ role: 'SUPER_ADMIN' }).count('id as count');
    if (Number(count) <= 1) throw new ApiError(400, 'LAST_SUPER_ADMIN', 'لا يمكن حذف آخر مدير عام في النظام');
  }
  await db('users').where({ id: targetId }).del();
}

/** هل النظام جديد ولم يُنشأ فيه أي مدير بعد؟ (يُستخدم لشاشة الإعداد الأولي) */
async function needsSetup() {
  const [{ count }] = await db('users').count('id as count');
  return Number(count) === 0;
}

/** الإعداد الأولي: ينشئ أول مدير عام — متاح فقط طالما لا يوجد أي مستخدم */
async function firstTimeSetup({ name, email, password }) {
  if (!(await needsSetup())) throw new ApiError(403, 'ALREADY_SETUP', 'تم إعداد النظام مسبقاً');
  await createUser({ name, email, password, role: 'SUPER_ADMIN' });
  return login(email, password);
}

module.exports = { getMe, changePassword, listUsers, deleteUser, needsSetup, firstTimeSetup, login, createUser, createClient, regenerateApiKey, listClients, setClientStatus };
