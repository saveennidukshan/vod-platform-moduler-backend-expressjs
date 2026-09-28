import Joi from 'joi';

const emailSchema = Joi.string().trim().lowercase().email({ tlds: { allow: false } });

export const userIdParamSchema = Joi.object({
  id: Joi.string().guid({ version: ['uuidv4'] }).required(),
});

export const updateMeSchema = Joi.object({
  email: emailSchema,
}).min(1);

export const updateUserByAdminSchema = Joi.object({
  email: emailSchema,
  role: Joi.string().valid('user', 'admin'),
  isEmailVerified: Joi.boolean(),
}).min(1);

export const listUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  role: Joi.string().valid('user', 'admin'),
  isEmailVerified: Joi.boolean().truthy('true').falsy('false'),
  search: Joi.string().trim().lowercase().max(255),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'email', 'role', 'isEmailVerified').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});
