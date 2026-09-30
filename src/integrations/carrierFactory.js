const MockAdapter = require('./adapters/MockAdapter');
const AramexAdapter = require('./adapters/AramexAdapter');
const SmsaAdapter = require('./adapters/SmsaAdapter');
const SaudiPostAdapter = require('./adapters/SaudiPostAdapter');
const InternalAdapter = require('./adapters/InternalAdapter');
const carrierConfig = require('../services/carrierConfig.service');

/**
 * ============================================================================
 * سجل شركات الشحن (Carrier Factory / Registry)
 * ============================================================================
 * ✅ لإضافة شركة شحن جديدة مستقبلاً (مثال: "أوتو" أو أي شركة أخرى):
 *   1. أنشئ ملف جديد في src/integrations/adapters/NewCarrierAdapter.js
 *      ينفّذ نفس دوال CarrierAdapter.js (createShipment, getTracking, ...)
 *   2. أضف سطر واحد هنا في الكائن ADAPTERS
 *   3. أضف سجلاً لها في جدول carriers (code, name, nameAr)
 * ✅ لا حاجة لتعديل أي controller أو service أو route — هذا هو معنى
 *    "طبقة الربط المرنة" المطلوبة.
 * ============================================================================
 */
const ADAPTERS = {
  internal: InternalAdapter, // أسطول الإلمام الخاص (مناديبنا) — للطلبات الواردة من شركات مثل "أوتو"
  mock: MockAdapter,
  aramex: AramexAdapter,
  smsa: SmsaAdapter,
  saudipost: SaudiPostAdapter,
};

async function getAdapter(carrierCode) {
  const AdapterClass = ADAPTERS[carrierCode];
  if (!AdapterClass) {
    const err = new Error(`لا يوجد محوّل مسجّل لشركة الشحن: ${carrierCode}`);
    err.statusCode = 400;
    err.code = 'UNKNOWN_CARRIER';
    throw err;
  }
  // بيانات الاعتماد المحفوظة من لوحة التحكم (مشفّرة) — تُقرأ عند كل استخدام فتسري التعديلات فوراً
  const config = await carrierConfig.getConfig(carrierCode);
  return new AdapterClass(config);
}

function listSupportedCarrierCodes() {
  return Object.keys(ADAPTERS);
}

module.exports = { getAdapter, listSupportedCarrierCodes };
