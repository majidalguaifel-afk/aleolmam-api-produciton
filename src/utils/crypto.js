const crypto = require('crypto');

/**
 * تشفير/فك تشفير الأسرار المحفوظة في قاعدة البيانات (مثل بيانات اعتماد أرامكس وسمسا)
 * الخوارزمية: AES-256-GCM (تشفير + ضمان عدم التلاعب)
 * المفتاح يُشتق من ENCRYPTION_KEY إن وُجد، وإلا من JWT_SECRET.
 * ⚠️ لو تغيّر هذا المفتاح لاحقاً، لن يمكن فك تشفير البيانات المحفوظة سابقاً
 *    (سيحتاج إدخال بيانات الاعتماد من جديد من لوحة التحكم).
 */
function getKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error('يلزم تعريف ENCRYPTION_KEY أو JWT_SECRET في متغيرات البيئة');
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptJson(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString('base64');
}

function decryptJson(str) {
  if (!str) return {};
  const raw = Buffer.from(str, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}

module.exports = { encryptJson, decryptJson };
