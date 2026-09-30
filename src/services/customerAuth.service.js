const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { generateId } = require('../utils/id');
const { generateOtp, hashOtp } = require('../utils/otp');
const { sendEmail, verificationEmailHtml } = require('../utils/email');
const { ApiError } = require('../middleware/errorHandler');

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

/** الخطوة 1: يرسل رمز تحقق لإيميل العميل (تسجيل أول مرة أو دخول لاحق — نفس المسار) */
async function requestCode(email, phone) {
  const { code, hash } = generateOtp();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  // نلغي أي أكواد سابقة غير مستخدمة لنفس الإيميل، حتى لا تتراكم
  await db('customer_verification_codes').where({ email }).del();
  await db('customer_verification_codes').insert({
    id: generateId('otp'), email, phone: phone || null, code_hash: hash, expires_at: expiresAt,
  });

  await sendEmail({ to: email, subject: 'رمز التحقق — تطبيق الإلمام', html: verificationEmailHtml(code) });
  return { email, expiresInMinutes: CODE_TTL_MINUTES };
}

/** الخطوة 2: يتحقق من الرمز، وينشئ حساب العميل لو أول مرة، ويرجع JWT */
async function verifyCode(email, code) {
  const row = await db('customer_verification_codes').where({ email }).first();
  if (!row) throw new ApiError(400, 'NO_CODE_REQUESTED', 'اطلب رمز تحقق جديد أولاً');
  if (new Date(row.expires_at) < new Date()) {
    await db('customer_verification_codes').where({ id: row.id }).del();
    throw new ApiError(400, 'CODE_EXPIRED', 'انتهت صلاحية الرمز، اطلب رمزاً جديداً');
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await db('customer_verification_codes').where({ id: row.id }).del();
    throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'محاولات كثيرة جداً، اطلب رمزاً جديداً');
  }
  if (row.code_hash !== hashOtp(String(code).trim())) {
    await db('customer_verification_codes').where({ id: row.id }).increment('attempts', 1);
    throw new ApiError(400, 'WRONG_CODE', 'الرمز غير صحيح');
  }

  await db('customer_verification_codes').where({ id: row.id }).del();

  let customer = await db('customer_accounts').where({ email }).first();
  if (!customer) {
    if (!row.phone) throw new ApiError(400, 'PHONE_REQUIRED', 'رقم الجوال مطلوب عند أول تسجيل');
    const id = generateId('cus');
    await db('customer_accounts').insert({ id, email, phone: row.phone, email_verified: true, last_login_at: db.fn.now() });
    customer = await db('customer_accounts').where({ id }).first();
  } else {
    await db('customer_accounts').where({ id: customer.id }).update({ email_verified: true, last_login_at: db.fn.now() });
  }

  const token = jwt.sign({ customerId: customer.id, type: 'customer' }, process.env.JWT_SECRET, { expiresIn: '90d' });
  return { token, customer: { id: customer.id, email: customer.email, phone: customer.phone } };
}

async function getMe(customerId) {
  const c = await db('customer_accounts').where({ id: customerId }).first();
  if (!c) throw new ApiError(401, 'CUSTOMER_NOT_FOUND', 'الحساب غير موجود');
  return { id: c.id, email: c.email, phone: c.phone };
}

module.exports = { requestCode, verifyCode, getMe };
