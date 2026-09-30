require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const { generateId } = require('../src/utils/id');
const { generateApiKey } = require('../src/utils/apiKey');

async function main() {
  console.log('🌱 بدء تعبئة البيانات الأولية...');

  // ---- شركات الشحن ----
  await require('../src/bootstrap').ensureCarriers();
  console.log('  ✓ شركات الشحن جاهزة');

  // ---- حساب مدير افتراضي ----
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@alelmam.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const existingAdmin = await db('users').where({ email: adminEmail }).first();
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await db('users').insert({
      id: generateId('usr'),
      name: 'مدير النظام',
      email: adminEmail,
      password_hash: passwordHash,
      role: 'SUPER_ADMIN',
    });
    console.log(`  ✓ حساب المدير: ${adminEmail} / ${adminPassword}  ⚠️ غيّر كلمة المرور فوراً بعد أول دخول`);
  } else {
    console.log(`  ↷ حساب المدير موجود مسبقاً: ${adminEmail}`);
  }

  // ---- عميل API تجريبي (لتجربة النظام فوراً) ----
  const existingDemoClient = await db('clients').where({ name: 'عميل تجريبي' }).first();
  if (!existingDemoClient) {
    const { fullKey, hash, prefix } = generateApiKey('test');
    await db('clients').insert({
      id: generateId('cli'),
      name: 'عميل تجريبي',
      contact_email: 'demo@example.com',
      api_key_hash: hash,
      api_key_prefix: prefix,
      rate_limit: 1000,
    });
    console.log(`  ✓ عميل تجريبي — مفتاح API: ${fullKey}  ⚠️ هذا يظهر مرة واحدة فقط، احفظه الآن`);
  } else {
    console.log('  ↷ العميل التجريبي موجود مسبقاً (لن يظهر مفتاحه القديم لأسباب أمنية — أنشئ مفتاحاً جديداً إذا لزم)');
  }

  // ---- مندوب تجريبي ----
  const existingDriver = await db('drivers').where({ name: 'مندوب تجريبي' }).first();
  if (!existingDriver) {
    await db('drivers').insert({
      id: generateId('drv'),
      name: 'مندوب تجريبي',
      phone: '0500000000',
      vehicle_info: 'سيارة تجريبية',
    });
    console.log('  ✓ مندوب تجريبي: مندوب تجريبي / 0500000000');
  }

  console.log('✅ اكتملت تعبئة البيانات الأولية بنجاح.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ فشل تعبئة البيانات الأولية:', err);
  process.exit(1);
});
