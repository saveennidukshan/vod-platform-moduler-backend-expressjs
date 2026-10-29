import Joi from 'joi';

const passwordSchema = Joi.string()
  .min(12)
  .max(128)
  .pattern(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
  .required()
  .messages({
    'string.pattern.base':
      'Password must include uppercase, lowercase, number, and special character.',
  });

const emailSchema = Joi.string()
  .trim()
  .lowercase()
  .email({ tlds: { allow: false } })
  .required();

export const registerSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  role: Joi.string().valid('user', 'admin').optional(),
});

export const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string().required(),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().optional(),
});

export const forgotPasswordSchema = Joi.object({
  email: emailSchema,
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: passwordSchema,
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: passwordSchema,
});

export const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
});

export const resendVerificationEmailSchema = Joi.object({
  email: emailSchema,
});
