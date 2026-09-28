import { AppError } from '../utils/errors.js';

const validator = (schema, source = 'body') => (req, res, next) => {
  const target = req[source] || {};
  const { error, value } = schema.validate(target, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return next(
      new AppError('Validation failed', 400, {
        errors: error.details.map((item) => item.message),
      })
    );
  }

  if (source === 'body') {
    req.body = value;
    return next();
  }

  const targetRef = req[source] || {};
  for (const key of Object.keys(targetRef)) {
    delete targetRef[key];
  }
  Object.assign(targetRef, value);

  return next();
};

export default validator;
