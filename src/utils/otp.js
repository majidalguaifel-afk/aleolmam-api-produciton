const crypto = require('crypto');

/** يولّد رمز تحقق مكوّن من 6 أرقام ويرجع بصمته المشفّرة (نفس نمط pin.js الخاص بالمناديب) */
function generateOtp() {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  return { code, hash: hashOtp(code) };
}
function hashOtp(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}
module.exports = { generateOtp, hashOtp };
