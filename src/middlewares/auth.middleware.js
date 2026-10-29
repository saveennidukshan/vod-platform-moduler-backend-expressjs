import { AppError } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';

export const protect = (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = header.slice(7).trim();
  if (!token || token.includes(' ')) {
    return next(new AppError('Invalid authorization header', 401));
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = payload;
    return next();
  } catch {
    return next(new AppError('Invalid or expired access token', 401));
  }
};

export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.auth) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.length || roles.includes(req.auth.role)) {
      return next();
    }

    return next(new AppError('Forbidden', 403));
  };

export const requireCsrfForCookieRefresh =
  ({ csrfCookieName, refreshTokenCookieName }) =>
  (req, res, next) => {
    const hasCookieRefresh = Boolean(req.cookies?.[refreshTokenCookieName]);
    if (!hasCookieRefresh) {
      return next();
    }

    const csrfCookie = req.cookies?.[csrfCookieName];
    const csrfHeader = req.headers['x-csrf-token'];

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return next(new AppError('Invalid CSRF token', 403));
    }

    return next();
  };
