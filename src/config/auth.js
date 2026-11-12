import dotenv from 'dotenv';

dotenv.config();

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined) return defaultValue;
  return String(value).toLowerCase() === 'true';
};

const parseNumber = (value, defaultValue) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const parseList = (value, fallback = []) => {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const isProduction = process.env.NODE_ENV === 'production';
const insecureDefaults = new Set([
  'dev-access-secret-change-me',
  'dev-refresh-secret-change-me',
  'dev-action-secret-change-me',
  'dev-refresh-hash-secret',
  'change_me_access',
  'change_me_refresh',
  'change_me_hash_secret',
]);

const readSecret = (value, fallback) => {
  const secret = value || fallback;
  if (isProduction && (!secret || insecureDefaults.has(secret) || secret.length < 32)) {
    throw new Error(
      'Production authentication secrets must be configured and at least 32 characters long.'
    );
  }
  return secret;
};

const now = () => new Date();
const jwtAccessSecret = readSecret(
  process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
  'dev-access-secret-change-me'
);
const jwtRefreshSecret = readSecret(
  process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  'dev-refresh-secret-change-me'
);
const tokenActionSecret = readSecret(
  process.env.JWT_ACTION_SECRET || process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
  'dev-action-secret-change-me'
);
const refreshTokenHashSecret = readSecret(
  process.env.REFRESH_TOKEN_HASH_SECRET || process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  'dev-refresh-hash-secret'
);

if (
  isProduction &&
  new Set([jwtAccessSecret, jwtRefreshSecret, tokenActionSecret, refreshTokenHashSecret]).size !== 4
) {
  throw new Error('Production authentication secrets must be distinct.');
}

const authConfig = {
  jwtAccessSecret,
  jwtRefreshSecret,
  tokenActionSecret,
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  emailVerifyTokenExpiresIn: process.env.EMAIL_VERIFY_TOKEN_EXPIRES_IN || '24h',
  resetTokenExpiresIn: process.env.RESET_TOKEN_EXPIRES_IN || '15m',
  bcryptSaltRounds: parseNumber(process.env.BCRYPT_SALT_ROUNDS, 12),
  frontendOrigin: parseList(process.env.FRONTEND_ORIGIN, ['http://localhost:3000']),
  cookieSecure: parseBoolean(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
  cookieSameSite: process.env.COOKIE_SAMESITE || 'strict',
  requireEmailVerification: parseBoolean(process.env.REQUIRE_EMAIL_VERIFICATION, false),
  authLockThreshold: parseNumber(process.env.AUTH_LOCK_THRESHOLD, 5),
  authLockMinutes: parseNumber(process.env.AUTH_LOCK_MINUTES, 15),
  authProgressiveDelayMs: parseNumber(process.env.AUTH_PROGRESSIVE_DELAY_MS, 250),
  loginRateLimitWindowMs: parseNumber(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  loginRateLimitMax: parseNumber(process.env.LOGIN_RATE_LIMIT_MAX, 10),
  resetRateLimitWindowMs: parseNumber(process.env.RESET_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  resetRateLimitMax: parseNumber(process.env.RESET_RATE_LIMIT_MAX, 5),
  refreshTokenCookieName: process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken',
  csrfCookieName: process.env.CSRF_COOKIE_NAME || 'csrfToken',
  refreshTokenHashSecret,
  isProduction,
  now,
};

const positiveSettings = [
  ['bcryptSaltRounds', authConfig.bcryptSaltRounds],
  ['authLockThreshold', authConfig.authLockThreshold],
  ['authLockMinutes', authConfig.authLockMinutes],
  ['authProgressiveDelayMs', authConfig.authProgressiveDelayMs],
  ['loginRateLimitWindowMs', authConfig.loginRateLimitWindowMs],
  ['loginRateLimitMax', authConfig.loginRateLimitMax],
  ['resetRateLimitWindowMs', authConfig.resetRateLimitWindowMs],
  ['resetRateLimitMax', authConfig.resetRateLimitMax],
];

for (const [name, value] of positiveSettings) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
}

if (
  !Number.isInteger(authConfig.bcryptSaltRounds) ||
  authConfig.bcryptSaltRounds < 4 ||
  authConfig.bcryptSaltRounds > 31
) {
  throw new Error('BCRYPT_SALT_ROUNDS must be an integer between 4 and 31.');
}

export default authConfig;
