import jwt from 'jsonwebtoken';
import authConfig from '../../config/auth.js';

const durationUnits = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export const parseDurationMs = (value) => {
  if (typeof value === 'number') return value * 1000;
  if (!value) return 0;
  const match = String(value)
    .trim()
    .match(/^(\d+)([smhd])$/i);
  if (!match) {
    const asSeconds = Number(value);
    return Number.isFinite(asSeconds) ? asSeconds * 1000 : 0;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  return amount * durationUnits[unit];
};

export const signAccessToken = (payload) => {
  return jwt.sign(payload, authConfig.jwtAccessSecret, {
    expiresIn: authConfig.accessTokenExpiresIn,
  });
};

export const signRefreshToken = (payload) => {
  return jwt.sign(payload, authConfig.jwtRefreshSecret, {
    expiresIn: authConfig.refreshTokenExpiresIn,
  });
};

export const signActionToken = (payload, expiresIn) => {
  return jwt.sign(payload, authConfig.tokenActionSecret, {
    expiresIn,
  });
};

export const verifyAccessToken = (token) => jwt.verify(token, authConfig.jwtAccessSecret);
export const verifyRefreshToken = (token) => jwt.verify(token, authConfig.jwtRefreshSecret);
export const verifyActionToken = (token) => jwt.verify(token, authConfig.tokenActionSecret);
