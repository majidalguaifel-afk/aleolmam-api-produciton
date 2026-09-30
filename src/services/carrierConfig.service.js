const db = require('../config/db');
const logger = require('../config/logger');
const { encryptJson, decryptJson } = require('../utils/crypto');
const { ApiError } = require('../middleware/errorHandler');

/**
 * تعريف حقول الربط لكل شركة شحن — هذا اللي تعرضه لوحة التحكم كنموذج جاهز.
 * secret=true  → لا تُعرض قيمته أبداً بعد الحفظ (يظهر فقط "محفوظ")
 * env          → متغير البيئة القديم (يُستخدم كقيمة احتياطية لو ما أُدخلت القيمة من اللوحة)
 */
const SCHEMAS = {
  internal: { label: 'أسطول الإلمام الداخلي', kind: 'internal', fields: [] },
  mock: { label: 'شركة تجريبية', kind: 'mock', fields: [] },
  aramex: {
    label: 'أرامكس',
    kind: 'external',
    fields: [
      { key: 'baseUrl', label: 'رابط الـ API', secret: false, required: true, env: 'ARAMEX_BASE_URL', placeholder: 'https://ws.aramex.net/...' },
      { key: 'username', label: 'اسم المستخدم', secret: false, required: true, env: 'ARAMEX_USERNAME' },
      { key: 'password', label: 'كلمة المرور', secret: true, required: true, env: 'ARAMEX_PASSWORD' },
      { key: 'accountNumber', label: 'رقم الحساب (Account Number)', secret: false, required: true, env: 'ARAMEX_ACCOUNT_NUMBER' },
      { key: 'accountPin', label: 'الرقم السري للحساب (Account PIN)', secret: true, required: true, env: 'ARAMEX_ACCOUNT_PIN' },
      { key: 'accountEntity', label: 'كود الجهة (Account Entity)', secret: false, required: true, env: 'ARAMEX_ACCOUNT_ENTITY' },
      { key: 'accountCountryCode', label: 'رمز الدولة', secret: false, required: false, env: 'ARAMEX_ACCOUNT_COUNTRY_CODE', placeholder: 'SA' },
    ],
  },
  smsa: {
    label: 'سمسا',
    kind: 'external',
    fields: [
      { key: 'baseUrl', label: 'رابط الـ API', secret: false, required: true, env: 'SMSA_BASE_URL' },
      { key: 'apiKey', label: 'مفتاح الـ API', secret: true, required: true, env: 'SMSA_API_KEY' },
      { key: 'password', label: 'كلمة المرور / رقم الحساب التجاري', secret: true, required: false, env: 'SMSA_PASSWORD' },
    ],
  },
  saudipost: {
    label: 'البريد السعودي (سبل)',
    kind: 'external',
    fields: [
      { key: 'baseUrl', label: 'رابط الـ API', secret: false, required: true, env: 'SAUDIPOST_BASE_URL' },
      { key: 'apiKey', label: 'مفتاح الـ API', secret: true, required: true, env: 'SAUDIPOST_API_KEY' },
    ],
  },
};

function schemaFor(code) {
  return SCHEMAS[code] || { label: code, kind: 'external', fields: [] };
}

async function readStored(carrierRow) {
  if (!carrierRow || !carrierRow.config_json) return {};
  try {
    return decryptJson(carrierRow.config_json);
  } catch (err) {
    logger.warn(`تعذّر فك تشفير إعدادات ${carrierRow.code} (ربما تغيّر مفتاح التشفير) — أعد إدخالها من لوحة التحكم`);
    return {};
  }
}

/** الإعدادات الفعلية المستخدمة عند الاتصال بشركة الشحن: قيم اللوحة أولاً ثم متغيرات البيئة كاحتياط */
async function getConfig(code) {
  const row = await db('carriers').where({ code }).first();
  const stored = await readStored(row);
  const schema = schemaFor(code);
  const config = {};
  for (const f of schema.fields) {
    const fromDb = stored[f.key];
    const fromEnv = f.env ? process.env[f.env] : undefined;
    config[f.key] = fromDb !== undefined && fromDb !== '' ? fromDb : fromEnv || '';
  }
  return config;
}

/** عرض آمن للوحة التحكم: لا يرجع الأسرار أبداً، فقط هل هي محفوظة أم لا */
async function getPublicView(row) {
  const schema = schemaFor(row.code);
  const stored = await readStored(row);
  const fields = schema.fields.map((f) => {
    const value = stored[f.key] !== undefined && stored[f.key] !== '' ? stored[f.key] : (f.env ? process.env[f.env] : '') || '';
    return {
      key: f.key,
      label: f.label,
      secret: !!f.secret,
      required: !!f.required,
      placeholder: f.placeholder || '',
      isSet: value !== '',
      value: f.secret ? '' : value,
    };
  });
  const requiredMissing = fields.filter((f) => f.required && !f.isSet).length;
  return {
    code: row.code,
    name: row.name,
    nameAr: row.name_ar,
    isActive: !!row.is_active,
    kind: schema.kind,
    fields,
    configured: schema.kind === 'external' ? requiredMissing === 0 && fields.length > 0 : true,
  };
}

async function listCarriersAdmin() {
  const rows = await db('carriers').orderBy('created_at', 'asc');
  const out = [];
  for (const r of rows) out.push(await getPublicView(r));
  return out;
}

async function saveConfig(code, values) {
  const row = await db('carriers').where({ code }).first();
  if (!row) throw new ApiError(404, 'CARRIER_NOT_FOUND', 'شركة الشحن غير موجودة');
  const schema = schemaFor(code);
  if (!schema.fields.length) throw new ApiError(400, 'NO_CONFIG_NEEDED', 'هذه الشركة لا تحتاج إعدادات ربط');

  const stored = await readStored(row);
  const next = { ...stored };
  for (const f of schema.fields) {
    const v = values[f.key];
    if (v === undefined || v === null) continue;
    const trimmed = String(v).trim();
    if (f.secret && trimmed === '') continue; // ترك السر كما هو
    if (trimmed === '') delete next[f.key];
    else next[f.key] = trimmed;
  }
  await db('carriers').where({ code }).update({ config_json: encryptJson(next) });
  return getPublicView(await db('carriers').where({ code }).first());
}

async function setActive(code, isActive) {
  const updated = await db('carriers').where({ code }).update({ is_active: isActive });
  if (!updated) throw new ApiError(404, 'CARRIER_NOT_FOUND', 'شركة الشحن غير موجودة');
  return getPublicView(await db('carriers').where({ code }).first());
}

module.exports = { SCHEMAS, schemaFor, getConfig, listCarriersAdmin, saveConfig, setActive };
