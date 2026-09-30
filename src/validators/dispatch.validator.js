const Joi = require('joi');

const createDriverSchema = Joi.object({
  name: Joi.string().min(2).required(),
  phone: Joi.string().pattern(/^(05|9665|\+9665)[0-9]{8}$/).required(),
  vehicleInfo: Joi.string().max(200).allow('', null),
});

const assignDriverSchema = Joi.object({
  driverId: Joi.string().required(),
});

const updateInternalStatusSchema = Joi.object({
  status: Joi.string().valid('CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED').required(),
  description: Joi.string().max(300).allow('', null),
  descriptionAr: Joi.string().max(300).allow('', null),
  location: Joi.string().max(200).allow('', null),
});

module.exports = { createDriverSchema, assignDriverSchema, updateInternalStatusSchema };
