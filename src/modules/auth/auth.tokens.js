import crypto from 'crypto';
import authConfig from '../../config/auth.js';
import { hashToken } from '../../shared/security/crypto.js';
import {
  parseDurationMs,
  signAccessToken,
  signActionToken,
  signRefreshToken,
} from '../../shared/security/jwt.js';

export const issueAccessToken = (user) => {
  return signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });
};

export const issueRefreshToken = ({
  user,
  family = crypto.randomUUID(),
  jti = crypto.randomUUID(),
}) => {
  const token = signRefreshToken({
    sub: user.id,
    jti,
    family,
    tokenVersion: user.tokenVersion,
  });

  return {
    token,
    tokenHash: hashToken(token),
    family,
    jti,
    expiresAt: new Date(Date.now() + parseDurationMs(authConfig.refreshTokenExpiresIn)),
  };
};

export const issueCsrfToken = () => {
  return crypto.randomBytes(24).toString('hex');
};

export const issueResetPasswordToken = (user) => {
  const token = signActionToken(
    { sub: user.id, purpose: 'reset_password', tokenVersion: user.tokenVersion },
    authConfig.resetTokenExpiresIn
  );

  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + parseDurationMs(authConfig.resetTokenExpiresIn)),
  };
};

export const issueEmailVerificationToken = (user) => {
  const token = signActionToken(
    { sub: user.id, purpose: 'verify_email', tokenVersion: user.tokenVersion },
    authConfig.emailVerifyTokenExpiresIn
  );

  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + parseDurationMs(authConfig.emailVerifyTokenExpiresIn)),
  };
};
