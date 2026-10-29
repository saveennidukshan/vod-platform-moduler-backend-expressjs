import { Router } from 'express';
import validator from '../../http/middleware/validator.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resendVerificationEmailSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.validation.js';
import { createAuthController } from './auth.controller.js';
import authConfig from '../../config/auth.js';
import { parseDurationMs } from '../../shared/security/jwt.js';
import { authorize, protect, requireCsrfForCookieRefresh } from '../../http/middleware/auth.js';
import {
  authRouteRateLimiter,
  loginRateLimiter,
  protectedRouteRateLimiter,
  resetRateLimiter,
} from '../../http/middleware/rate-limit.js';

const route = Router();

const cookieOptions = {
  secure: authConfig.cookieSecure,
  sameSite: authConfig.cookieSameSite,
  refreshMaxAge: parseDurationMs(authConfig.refreshTokenExpiresIn),
  refreshTokenCookieName: authConfig.refreshTokenCookieName,
  csrfCookieName: authConfig.csrfCookieName,
};

const controller = createAuthController({ cookieOptions });

route.post('/register', authRouteRateLimiter, validator(registerSchema), controller.register);
route.post('/signup', authRouteRateLimiter, validator(registerSchema), controller.register);
route.post('/login', loginRateLimiter, validator(loginSchema), controller.login);
route.post(
  '/refresh-token',
  authRouteRateLimiter,
  requireCsrfForCookieRefresh({
    csrfCookieName: authConfig.csrfCookieName,
    refreshTokenCookieName: authConfig.refreshTokenCookieName,
  }),
  validator(refreshTokenSchema),
  controller.refreshToken
);
route.post(
  '/logout',
  authRouteRateLimiter,
  requireCsrfForCookieRefresh({
    csrfCookieName: authConfig.csrfCookieName,
    refreshTokenCookieName: authConfig.refreshTokenCookieName,
  }),
  controller.logout
);
route.get('/me', protectedRouteRateLimiter, protect, controller.me);
route.post(
  '/forgot-password',
  resetRateLimiter,
  validator(forgotPasswordSchema),
  controller.forgotPassword
);
route.post(
  '/reset-password',
  resetRateLimiter,
  validator(resetPasswordSchema),
  controller.resetPassword
);
route.post(
  '/change-password',
  authRouteRateLimiter,
  protect,
  validator(changePasswordSchema),
  controller.changePassword
);
route.post(
  '/verify-email',
  authRouteRateLimiter,
  validator(verifyEmailSchema),
  controller.verifyEmail
);
route.post(
  '/resend-verification-email',
  authRouteRateLimiter,
  validator(resendVerificationEmailSchema),
  controller.resendVerificationEmail
);

route.get(
  '/protected-sample',
  protectedRouteRateLimiter,
  protect,
  authorize('admin', 'user'),
  controller.protectedAdminSample
);

export default route;
