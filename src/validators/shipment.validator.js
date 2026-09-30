const Joi = require('joi');

const createShipmentSchema = Joi.object({
  carrierCode: Joi.string().required().messages({ 'any.required': 'carrierCode مطلوب (مثال: aramex, smsa, mock)' }),
  senderName: Joi.string().min(2).required(),
  senderPhone: Joi.string().pattern(/^(05|9665|\+9665)[0-9]{8}$/).required().messages({
    'string.pattern.base': 'senderPhone يجب أن يكون رقم جوال سعودي صحيح (مثال: 05xxxxxxxx)',
  }),
  senderAddress: Joi.string().min(3).required(),
  senderCity: Joi.string().min(2).required(),

  recipientName: Joi.string().min(2).required(),
  recipientPhone: Joi.string().pattern(/^(05|9665|\+9665)[0-9]{8}$/).required(),
  recipientAddress: Joi.string().min(3).required(),
  recipientCity: Joi.string().min(2).required(),

  weightKg: Joi.number().positive().max(1000).required(),
  packageDesc: Joi.string().max(500).allow('', null),
  codAmount: Joi.number().min(0).allow(null),
  declaredValue: Joi.number().min(0).allow(null),
});

const updateShipmentSchema = Joi.object({
  recipientName: Joi.string().min(2),
  recipientPhone: Joi.string().pattern(/^(05|9665|\+9665)[0-9]{8}$/),
  recipientAddress: Joi.string().min(3),
  recipientCity: Joi.string().min(2),
  packageDesc: Joi.string().max(500).allow('', null),
}).min(1);

const listShipmentsQuerySchema = Joi.object({
  status: Joi.string().valid('PENDING', 'CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED', 'RETURNED'),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

const idParamSchema = Joi.object({
  id: Joi.string().required(),
});

module.exports = { createShipmentSchema, updateShipmentSchema, listShipmentsQuerySchema, idParamSchema };
