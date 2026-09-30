const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const createUserSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('SUPER_ADMIN', 'ADMIN', 'OPERATOR').default('ADMIN'),
});

const createClientSchema = Joi.object({
  name: Joi.string().min(2).required(),
  contactEmail: Joi.string().email().required(),
  contactPhone: Joi.string().allow('', null),
  rateLimit: Joi.number().integer().min(1).max(10000).default(100),
});

const registerWebhookSchema = Joi.object({
  url: Joi.string().uri({ scheme: ['https'] }).required().messages({
    'string.uri': 'رابط الويب هوك يجب أن يبدأ بـ https:// لأسباب أمنية',
  }),
  events: Joi.array().items(Joi.string().valid('shipment.created', 'shipment.status_changed', 'shipment.cancelled', '*')).min(1).required(),
});

module.exports = { loginSchema, createUserSchema, createClientSchema, registerWebhookSchema };

// ---- إضافات لوحة التحكم ----
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(100).required().messages({
    'string.min': 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل',
  }),
});

const setupSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required().messages({
    'string.min': 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
  }),
  setupKey: Joi.string().allow('', null).max(200),
});

module.exports.changePasswordSchema = changePasswordSchema;
module.exports.setupSchema = setupSchema;
