import rateLimit from 'express-rate-limit';
import authConfig from '../configs/auth.config.js';

const skipForTests = () => process.env.NODE_ENV === 'test';

const createLimiter = ({ windowMs, max }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipForTests,
    message: {
      success: false,
      message: 'Too many requests. Please try again later.',
    },
  });

export const apiRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 300,
});

export const loginRateLimiter = createLimiter({
  windowMs: authConfig.loginRateLimitWindowMs,
  max: authConfig.loginRateLimitMax,
});

export const resetRateLimiter = createLimiter({
  windowMs: authConfig.resetRateLimitWindowMs,
  max: authConfig.resetRateLimitMax,
});

export const authRouteRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
});

export const protectedRouteRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 120,
});

export const clearRateLimitBucketsForTests = () => {};
