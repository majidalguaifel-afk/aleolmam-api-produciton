const Joi = require('joi');
const driverLoginSchema = Joi.object({
  phone: Joi.string().pattern(/^(05|9665|\+9665)[0-9]{8}$/).required(),
  pin: Joi.string().length(6).pattern(/^[0-9]+$/).required().messages({ 'string.length': 'الرمز مكوّن من 6 أرقام' }),
});
const driverStatusSchema = Joi.object({
  status: Joi.string().valid('PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED').required(),
  descriptionAr: Joi.string().max(300).allow('', null),
  location: Joi.string().max(200).allow('', null),
  deliveryCode: Joi.string().length(4).pattern(/^[0-9]+$/).when('status', { is: 'DELIVERED', then: Joi.required() }).messages({
    'string.length': 'كود التسليم مكوّن من 4 أرقام',
    'any.required': 'اطلب كود التسليم من العميل أولاً',
  }),
});
const driverLocationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});
module.exports = { driverLoginSchema, driverStatusSchema, driverLocationSchema };
