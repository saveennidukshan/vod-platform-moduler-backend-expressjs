import { Router } from 'express';
import { authorize, protect } from '../../http/middleware/auth.js';
import { protectedRouteRateLimiter } from '../../http/middleware/rate-limit.js';
import validator from '../../http/middleware/validator.js';
import {
  getCurrentUserProfile,
  getUserById,
  getUsers,
  updateCurrentUser,
  updateUser,
} from './user.controller.js';
import {
  listUsersQuerySchema,
  updateMeSchema,
  updateUserByAdminSchema,
  userIdParamSchema,
} from './user.validation.js';

const route = Router();

route.get('/me', protectedRouteRateLimiter, protect, getCurrentUserProfile);
route.patch(
  '/me',
  protectedRouteRateLimiter,
  protect,
  validator(updateMeSchema),
  updateCurrentUser
);

route.get(
  '/',
  protectedRouteRateLimiter,
  protect,
  authorize('admin'),
  validator(listUsersQuerySchema, 'query'),
  getUsers
);
route.get(
  '/:id',
  protectedRouteRateLimiter,
  protect,
  authorize('admin'),
  validator(userIdParamSchema, 'params'),
  getUserById
);
route.patch(
  '/:id',
  protectedRouteRateLimiter,
  protect,
  authorize('admin'),
  validator(userIdParamSchema, 'params'),
  validator(updateUserByAdminSchema),
  updateUser
);

export default route;
