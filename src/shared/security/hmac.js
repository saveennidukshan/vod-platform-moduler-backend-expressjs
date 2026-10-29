import crypto from 'crypto';
import { findUserByEmail } from '../../modules/users/user.service.js';

const getUserPassword = async (email) => {
  const user = await findUserByEmail(String(email || '').toLowerCase());
  return user?.passwordHash || '';
};

export const genHMAC = async (email) => {
  const ts = Date.now();

  const hmac = crypto
    .createHmac('sha256', `${process.env.HMAC_KEY || ''}${await getUserPassword(email)}`)
    .update(email + '|' + ts)
    .digest('hex');

  return {
    email,
    ts,
    hmac,
  };
};

export const validateHMAC = async (data) => {
  if (
    !data ||
    typeof data.email !== 'string' ||
    !Number.isFinite(Number(data.ts)) ||
    typeof data.hmac !== 'string'
  ) {
    return false;
  }

  const timestamp = Number(data.ts);
  const hmac = crypto
    .createHmac('sha256', `${process.env.HMAC_KEY || ''}${await getUserPassword(data.email)}`)
    .update(`${data.email}|${timestamp}`)
    .digest('hex');

  const expected = Buffer.from(hmac, 'hex');
  const provided = Buffer.from(data.hmac, 'hex');
  return (
    Date.now() - timestamp <= 5 * 60 * 1000 &&
    Date.now() - timestamp >= -30 * 1000 &&
    expected.length === provided.length &&
    crypto.timingSafeEqual(expected, provided)
  );
};
