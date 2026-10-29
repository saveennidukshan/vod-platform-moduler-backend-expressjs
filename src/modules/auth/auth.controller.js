import {
  changePassword,
  forgotPassword,
  getMe,
  login,
  logout,
  refreshSession,
  register,
  resendVerificationEmail,
  resetPassword,
  verifyEmail,
} from './auth.service.js';

const getContext = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') || 'unknown',
});

const setRefreshCookies = (res, { refreshToken, csrfToken }, cookieOptions) => {
  res.cookie(cookieOptions.refreshTokenCookieName, refreshToken, {
    httpOnly: true,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: '/api/v1/auth',
    maxAge: cookieOptions.refreshMaxAge,
  });

  res.cookie(cookieOptions.csrfCookieName, csrfToken, {
    httpOnly: false,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: '/api/v1/auth',
    maxAge: cookieOptions.refreshMaxAge,
  });
};

const clearRefreshCookies = (res, cookieOptions) => {
  res.clearCookie(cookieOptions.refreshTokenCookieName, {
    httpOnly: true,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: '/api/v1/auth',
  });

  res.clearCookie(cookieOptions.csrfCookieName, {
    httpOnly: false,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: '/api/v1/auth',
  });
};

export const createAuthController = ({ cookieOptions }) => ({
  register: async (req, res) => {
    const result = await register(req.body, getContext(req));
    setRefreshCookies(res, result, cookieOptions);
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  },

  login: async (req, res) => {
    const result = await login(req.body, getContext(req));
    setRefreshCookies(res, result, cookieOptions);
    return res.status(200).json({
      success: true,
      message: 'User logged in successfully',
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  },

  logout: async (req, res) => {
    const refreshToken =
      req.cookies?.[cookieOptions.refreshTokenCookieName] || req.body.refreshToken;
    await logout({ refreshToken });
    clearRefreshCookies(res, cookieOptions);
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  },

  refreshToken: async (req, res) => {
    const refreshToken =
      req.cookies?.[cookieOptions.refreshTokenCookieName] || req.body.refreshToken;
    const result = await refreshSession({ refreshToken }, getContext(req));
    setRefreshCookies(res, result, cookieOptions);

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  },

  me: async (req, res) => {
    const user = await getMe(req.auth.sub);
    return res.status(200).json({
      success: true,
      message: 'Current user fetched successfully',
      data: { user },
    });
  },

  forgotPassword: async (req, res) => {
    await forgotPassword(req.body);
    return res.status(200).json({
      success: true,
      message: 'If that email exists, a reset message has been sent.',
    });
  },

  resetPassword: async (req, res) => {
    await resetPassword(req.body);
    clearRefreshCookies(res, cookieOptions);
    return res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  },

  changePassword: async (req, res) => {
    await changePassword({
      userId: req.auth.sub,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });
    clearRefreshCookies(res, cookieOptions);
    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  },

  verifyEmail: async (req, res) => {
    await verifyEmail(req.body);
    return res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    });
  },

  resendVerificationEmail: async (req, res) => {
    await resendVerificationEmail(req.body);
    return res.status(200).json({
      success: true,
      message: 'If eligible, verification email has been resent.',
    });
  },

  protectedAdminSample: async (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Protected route access granted',
      data: {
        userId: req.auth.sub,
        role: req.auth.role,
      },
    });
  },
});
