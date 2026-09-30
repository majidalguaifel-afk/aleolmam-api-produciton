const Joi = require('joi');

const requestCodeSchema = Joi.object({
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^(05|9665|\+9665)[0-9]{8}$/).messages({
    'string.pattern.base': 'رقم جوال سعودي غير صحيح',
  }), // اختياري: مطلوب فقط أول مرة (لو الحساب ما موجود بعد نتأكد منه وقت التحقق)
});

const verifyCodeSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).pattern(/^[0-9]+$/).required().messages({
    'string.length': 'الرمز مكوّن من 6 أرقام',
  }),
});

module.exports = { requestCodeSchema, verifyCodeSchema };
