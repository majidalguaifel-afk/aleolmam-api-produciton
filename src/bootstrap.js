const path = require('path');
const db = require('./config/db');
const logger = require('./config/logger');
const { generateId } = require('./utils/id');

const DEFAULT_CARRIERS = [
  { code: 'internal', name: 'Al-Elmam Fleet', name_ar: 'أسطول الإلمام الداخلي' },
  { code: 'mock', name: 'Mock Carrier (Testing)', name_ar: 'شركة تجريبية (للاختبار)' },
  { code: 'aramex', name: 'Aramex', name_ar: 'أرامكس' },
  { code: 'smsa', name: 'SMSA Express', name_ar: 'سمسا' },
  { code: 'saudipost', name: 'Saudi Post (SPL)', name_ar: 'البريد السعودي (سبل)' },
];

/** يسجّل شركات الشحن الافتراضية إن لم تكن موجودة (آمن للتكرار) */
async function ensureCarriers() {
  for (const c of DEFAULT_CARRIERS) {
    const exists = await db('carriers').where({ code: c.code }).first();
    if (!exists) await db('carriers').insert({ id: generateId('car'), ...c });
  }
}

/** يشغّل ترحيلات قاعدة البيانات تلقائياً، ثم يضمن وجود شركات الشحن */
async function bootstrap() {
  const [batch, applied] = await db.migrate.latest({ directory: path.join(__dirname, '..', 'migrations') });
  if (applied.length) logger.info(`تم تطبيق ${applied.length} ترحيل على قاعدة البيانات (دفعة ${batch})`);
  await ensureCarriers();
}

module.exports = { bootstrap, ensureCarriers, DEFAULT_CARRIERS };
