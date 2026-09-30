const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { hashPin } = require('../utils/pin');
const { ApiError } = require('../middleware/errorHandler');

async function login(phone, pin) {
  const driver = await db('drivers').where({ phone }).first();
  if (!driver || !driver.is_active) throw new ApiError(401, 'INVALID_CREDENTIALS', 'رقم الجوال أو الرمز غير صحيح');
  if (driver.pin_hash !== hashPin(pin)) throw new ApiError(401, 'INVALID_CREDENTIALS', 'رقم الجوال أو الرمز غير صحيح');

  await db('drivers').where({ id: driver.id }).update({ last_login_at: db.fn.now() });
  const token = jwt.sign({ driverId: driver.id, type: 'driver' }, process.env.JWT_SECRET, { expiresIn: '30d' });
  return { token, driver: { id: driver.id, name: driver.name, phone: driver.phone } };
}

async function getMe(driverId) {
  const driver = await db('drivers').where({ id: driverId }).first();
  if (!driver || !driver.is_active) throw new ApiError(401, 'DRIVER_NOT_FOUND', 'الحساب غير موجود أو موقوف');
  return { id: driver.id, name: driver.name, phone: driver.phone };
}

module.exports = { login, getMe };
