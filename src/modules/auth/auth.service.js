import authConfig from '../../configs/auth.config.js';
import { sendAuthEmail } from '../../utils/email.js';
import { AppError } from '../../utils/errors.js';
import { comparePassword, hashPassword, hashToken, safeEqual } from '../../utils/crypto.js';
import { verifyActionToken, verifyRefreshToken } from '../../utils/jwt.js';
import {
  issueAccessToken,
  issueCsrfToken,
  issueEmailVerificationToken,
  issueRefreshToken,
  issueResetPasswordToken,
} from './auth.tokens.js';
import { createUser, findUserByEmail, findUserById, sanitizeUser, updateUser } from '../users/user.service.js';
import {
  findRefreshTokenByJti,
  revokeRefreshTokenByJti,
  revokeRefreshTokenFamily,
  revokeRefreshTokensByUserId,
  saveRefreshToken,
} from './auth.token.model.js';

const authAudit = (event, details = {}) => {
  console.info('[auth.audit]', event, {
    userId: details.userId,
    email: details.email,
    ip: details.ip,
    userAgent: details.userAgent,
  });
};

const applyProgressiveDelay = async (failedAttempts) => {
  const delay = Math.min(failedAttempts * authConfig.authProgressiveDelayMs, 3000);
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
};

const isAccountLocked = (user) => {
  return user.lockUntil && new Date(user.lockUntil).getTime() > Date.now();
};

const buildTokenBundle = async ({ user, ip, userAgent, family, previousJti }) => {
  const accessToken = issueAccessToken(user);
  const csrfToken = issueCsrfToken();
  const refresh = issueRefreshToken({ user, family });

  await saveRefreshToken({
    userId: user.id,
    tokenJti: refresh.jti,
    tokenFamily: refresh.family,
    tokenHash: refresh.tokenHash,
    expiresAt: refresh.expiresAt,
    revokedAt: null,
    replacedByJti: null,
    createdIp: ip,
    userAgent,
    createdAt: new Date(),
  });

  if (previousJti) {
    await revokeRefreshTokenByJti(previousJti, refresh.jti);
  }

  return {
    accessToken,
    refreshToken: refresh.token,
    csrfToken,
    refreshFamily: refresh.family,
    refreshJti: refresh.jti,
  };
};

export const register = async ({ email, password }, context) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw new AppError('User already registered', 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({
    email: normalizedEmail,
    passwordHash,
    role: 'user',
    isEmailVerified: false,
  });

  const verify = issueEmailVerificationToken(user);
  const updated = await updateUser(user.id, {
    emailVerificationTokenHash: verify.tokenHash,
    emailVerificationExpiresAt: verify.expiresAt,
  });

  const tokenBundle = await buildTokenBundle({
    user: updated,
    ip: context.ip,
    userAgent: context.userAgent,
  });

  authAudit('register_success', { userId: user.id, email: user.email, ip: context.ip, userAgent: context.userAgent });

  await sendAuthEmail({
    email: user.email,
    subject: 'Verify your email',
    text: `Verify your account using this token: ${verify.token}`,
    html: `<p>Verify your account using this token:</p><p><code>${verify.token}</code></p>`,
  });

  return {
    user: sanitizeUser(updated),
    ...tokenBundle,
  };
};

export const login = async ({ email, password }, context) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    await applyProgressiveDelay(1);
    throw new AppError('Invalid email or password', 401);
  }

  if (isAccountLocked(user)) {
    throw new AppError('Account temporarily locked. Try again later.', 423);
  }

  const passwordOk = await comparePassword(password, user.passwordHash);
  if (!passwordOk) {
    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
    const shouldLock = failedAttempts >= authConfig.authLockThreshold;
    await updateUser(user.id, {
      failedLoginAttempts: shouldLock ? 0 : failedAttempts,
      lockUntil: shouldLock ? new Date(Date.now() + authConfig.authLockMinutes * 60 * 1000) : user.lockUntil,
    });

    await applyProgressiveDelay(failedAttempts);
    authAudit('login_failed', { userId: user.id, email: user.email, ip: context.ip, userAgent: context.userAgent });
    throw new AppError('Invalid email or password', 401);
  }

  if (authConfig.requireEmailVerification && !user.isEmailVerified) {
    throw new AppError('Please verify your email before login.', 403);
  }

  const updated = await updateUser(user.id, {
    failedLoginAttempts: 0,
    lockUntil: null,
  });

  const tokenBundle = await buildTokenBundle({
    user: updated,
    ip: context.ip,
    userAgent: context.userAgent,
  });

  authAudit('login_success', { userId: user.id, email: user.email, ip: context.ip, userAgent: context.userAgent });

  return {
    user: sanitizeUser(updated),
    ...tokenBundle,
  };
};

export const logout = async ({ refreshToken }) => {
  if (!refreshToken) return;

  try {
    const payload = verifyRefreshToken(refreshToken);
    if (payload?.jti) {
      await revokeRefreshTokenByJti(payload.jti);
    }
  } catch {
    return;
  }
};

export const refreshSession = async ({ refreshToken }, context) => {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  const tokenRecord = await findRefreshTokenByJti(payload.jti);
  if (!tokenRecord) {
    if (payload.family) {
      await revokeRefreshTokenFamily(payload.family);
    }
    throw new AppError('Refresh token reuse detected', 401);
  }

  if (tokenRecord.revokedAt) {
    await revokeRefreshTokenFamily(tokenRecord.tokenFamily);
    throw new AppError('Refresh token reuse detected', 401);
  }

  if (!tokenRecord.expiresAt || new Date(tokenRecord.expiresAt).getTime() <= Date.now()) {
    throw new AppError('Refresh token expired', 401);
  }

  const providedHash = hashToken(refreshToken);
  if (!safeEqual(providedHash, tokenRecord.tokenHash)) {
    await revokeRefreshTokenFamily(tokenRecord.tokenFamily);
    throw new AppError('Refresh token reuse detected', 401);
  }

  const user = await findUserById(payload.sub);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (payload.tokenVersion !== user.tokenVersion) {
    await revokeRefreshTokenFamily(tokenRecord.tokenFamily);
    throw new AppError('Refresh token invalidated', 401);
  }

  const tokenBundle = await buildTokenBundle({
    user,
    ip: context.ip,
    userAgent: context.userAgent,
    family: tokenRecord.tokenFamily,
    previousJti: tokenRecord.tokenJti,
  });

  authAudit('refresh_success', { userId: user.id, email: user.email, ip: context.ip, userAgent: context.userAgent });

  return {
    user: sanitizeUser(user),
    ...tokenBundle,
  };
};

export const getMe = async (userId) => {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return sanitizeUser(user);
};

export const forgotPassword = async ({ email }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    return;
  }

  const reset = issueResetPasswordToken(user);
  await updateUser(user.id, {
    resetPasswordTokenHash: reset.tokenHash,
    resetPasswordExpiresAt: reset.expiresAt,
  });

  await sendAuthEmail({
    email: user.email,
    subject: 'Reset your password',
    text: `Reset password token: ${reset.token}`,
    html: `<p>Use this token to reset your password:</p><p><code>${reset.token}</code></p>`,
  });

  authAudit('forgot_password_requested', { userId: user.id, email: user.email });
};

export const resetPassword = async ({ token, newPassword }) => {
  let payload;
  try {
    payload = verifyActionToken(token);
  } catch {
    throw new AppError('Invalid or expired reset token', 400);
  }

  if (payload.purpose !== 'reset_password') {
    throw new AppError('Invalid reset token', 400);
  }

  const user = await findUserById(payload.sub);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.resetPasswordTokenHash || !safeEqual(user.resetPasswordTokenHash, hashToken(token))) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  if (!user.resetPasswordExpiresAt || new Date(user.resetPasswordExpiresAt).getTime() <= Date.now()) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  const updated = await updateUser(user.id, {
    passwordHash: await hashPassword(newPassword),
    passwordChangedAt: new Date(),
    tokenVersion: (user.tokenVersion || 0) + 1,
    resetPasswordTokenHash: null,
    resetPasswordExpiresAt: null,
    failedLoginAttempts: 0,
    lockUntil: null,
  });

  await revokeRefreshTokensByUserId(user.id);
  authAudit('password_reset_success', { userId: user.id, email: user.email });

  return sanitizeUser(updated);
};

export const changePassword = async ({ userId, currentPassword, newPassword }) => {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const ok = await comparePassword(currentPassword, user.passwordHash);
  if (!ok) {
    throw new AppError('Current password is incorrect', 400);
  }

  const updated = await updateUser(user.id, {
    passwordHash: await hashPassword(newPassword),
    passwordChangedAt: new Date(),
    tokenVersion: (user.tokenVersion || 0) + 1,
  });

  await revokeRefreshTokensByUserId(user.id);
  authAudit('password_changed', { userId: user.id, email: user.email });

  return sanitizeUser(updated);
};

export const verifyEmail = async ({ token }) => {
  let payload;
  try {
    payload = verifyActionToken(token);
  } catch {
    throw new AppError('Invalid or expired verification token', 400);
  }

  if (payload.purpose !== 'verify_email') {
    throw new AppError('Invalid verification token', 400);
  }

  const user = await findUserById(payload.sub);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.emailVerificationTokenHash || !safeEqual(user.emailVerificationTokenHash, hashToken(token))) {
    throw new AppError('Invalid or expired verification token', 400);
  }

  if (!user.emailVerificationExpiresAt || new Date(user.emailVerificationExpiresAt).getTime() <= Date.now()) {
    throw new AppError('Invalid or expired verification token', 400);
  }

  const updated = await updateUser(user.id, {
    isEmailVerified: true,
    emailVerificationTokenHash: null,
    emailVerificationExpiresAt: null,
  });

  authAudit('email_verified', { userId: user.id, email: user.email });
  return sanitizeUser(updated);
};

export const resendVerificationEmail = async ({ email }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (!user || user.isEmailVerified) {
    return;
  }

  const verify = issueEmailVerificationToken(user);
  await updateUser(user.id, {
    emailVerificationTokenHash: verify.tokenHash,
    emailVerificationExpiresAt: verify.expiresAt,
  });

  await sendAuthEmail({
    email: user.email,
    subject: 'Verify your email',
    text: `Verification token: ${verify.token}`,
    html: `<p>Verification token:</p><p><code>${verify.token}</code></p>`,
  });

  authAudit('verification_email_resent', { userId: user.id, email: user.email });
};
