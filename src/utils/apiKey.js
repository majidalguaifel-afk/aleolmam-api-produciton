const crypto = require('crypto');
const { nanoid } = require('nanoid');

/**
 * يولّد مفتاح API جديد بصيغة: alk_live_<32 حرف عشوائي>
 * ويرجع أيضاً الـ hash (SHA-256) المخزَّن في القاعدة، والـ prefix المعروض في اللوحة.
 * المفتاح الفعلي يُعرض للعميل مرة واحدة فقط لحظة الإنشاء — لا يُخزَّن أبداً بنص صريح.
 */
function generateApiKey(env = 'live') {
  const secret = nanoid(32);
  const fullKey = `alk_${env}_${secret}`;
  const hash = hashApiKey(fullKey);
  const prefix = fullKey.slice(0, 12) + '...';
  return { fullKey, hash, prefix };
}

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

module.exports = { generateApiKey, hashApiKey };
