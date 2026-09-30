const crypto = require('crypto');

/** يولّد رمز دخول مكوّن من 6 أرقام (سهل الكتابة على الجوال) ويرجع بصمته المشفّرة */
function generatePin() {
  const pin = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  return { pin, hash: hashPin(pin), prefix: '••' + pin.slice(-2) };
}
function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}
module.exports = { generatePin, hashPin };
