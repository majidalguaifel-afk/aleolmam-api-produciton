const { ApiError } = require('./errorHandler');

/**
 * middleware factory: يتحقق من body/query/params حسب مخطط Joi معطى
 * validate({ body: createShipmentSchema })
 */
function validate(schemas) {
  return (req, res, next) => {
    for (const key of ['body', 'query', 'params']) {
      if (schemas[key]) {
        const { error, value } = schemas[key].validate(req[key], { abortEarly: false, stripUnknown: true });
        if (error) {
          const details = error.details.map((d) => d.message).join(' | ');
          return next(new ApiError(422, 'VALIDATION_ERROR', `بيانات غير صحيحة: ${details}`));
        }
        req[key] = value;
      }
    }
    next();
  };
}

module.exports = validate;
