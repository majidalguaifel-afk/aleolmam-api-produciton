const Joi = require('joi');
const { createShipmentSchema } = require('./shipment.validator');

// إنشاء طلب يدوياً من لوحة التحكم نيابة عن عميل
const adminCreateShipmentSchema = createShipmentSchema.keys({
  clientId: Joi.string().required().messages({ 'any.required': 'اختر العميل صاحب الطلب' }),
});

const adminListShipmentsQuerySchema = Joi.object({
  status: Joi.string().valid('PENDING', 'CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED', 'RETURNED'),
  carrier: Joi.string(),
  clientId: Joi.string(),
  driverId: Joi.string(),
  q: Joi.string().max(100),
  assigned: Joi.string().valid('yes', 'no'),
  active: Joi.string().valid('true', 'false'),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

const carrierConfigSchema = Joi.object().pattern(Joi.string(), Joi.string().allow('', null).max(500));
const carrierToggleSchema = Joi.object({ isActive: Joi.boolean().required() });

module.exports = { adminCreateShipmentSchema, adminListShipmentsQuerySchema, carrierConfigSchema, carrierToggleSchema };
