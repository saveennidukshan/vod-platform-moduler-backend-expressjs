import { Router } from 'express';
import { authorize, protect } from '../../middlewares/auth.middleware.js';
import { protectedRouteRateLimiter } from '../../middlewares/rateLimit.middleware.js';
import validator from '../../middlewares/validator.js';
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
route.patch('/me', protectedRouteRateLimiter, protect, validator(updateMeSchema), updateCurrentUser);

route.get('/', protectedRouteRateLimiter, protect, authorize('admin'), validator(listUsersQuerySchema, 'query'), getUsers);
route.get('/:id', protectedRouteRateLimiter, protect, authorize('admin'), validator(userIdParamSchema, 'params'), getUserById);
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
