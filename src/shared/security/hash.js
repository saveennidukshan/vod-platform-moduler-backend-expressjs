import { comparePassword, hashPassword } from './crypto.js';

export const createHash = async (password) => {
  return hashPassword(password);
};

export const compareHash = async (password, hash) => {
  return comparePassword(password, hash);
};
