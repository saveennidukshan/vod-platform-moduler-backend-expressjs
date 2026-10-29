import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import authConfig from '../../config/auth.js';

export const hashPassword = async (password) => {
  return bcrypt.hash(password, authConfig.bcryptSaltRounds);
};

export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

export const hashToken = (token) => {
  return crypto.createHmac('sha256', authConfig.refreshTokenHashSecret).update(token).digest('hex');
};

export const randomToken = (size = 32) => {
  return crypto.randomBytes(size).toString('hex');
};

export const safeEqual = (a, b) => {
  const first = Buffer.from(a || '', 'utf8');
  const second = Buffer.from(b || '', 'utf8');
  if (first.length !== second.length) return false;
  return crypto.timingSafeEqual(first, second);
};
