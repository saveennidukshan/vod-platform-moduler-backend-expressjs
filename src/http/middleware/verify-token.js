import { BadResponse } from '../../shared/http/responses.js';
import { verifyAccessToken, verifyRefreshToken } from '../../shared/security/jwt.js';

const extractBearerToken = (value) => {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('Bearer ')) return value.slice(7);
  return value;
};

export const verifyAuthToken = (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return new BadResponse('Invalid token').send(res, 401);

  try {
    req.payload = verifyAccessToken(token);
    next();
  } catch {
    return new BadResponse('Token Expired').send(res, 401);
  }
};

export const verifyRfToken = (req, res, next) => {
  const token = extractBearerToken(req.body.rftoken || req.body.refreshToken);
  if (!token) return new BadResponse('Invalid token').send(res, 401);

  try {
    req.payload = verifyRefreshToken(token);
    next();
  } catch {
    return new BadResponse('Token Expired').send(res, 401);
  }
};
