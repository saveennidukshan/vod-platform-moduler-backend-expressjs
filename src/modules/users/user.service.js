import { AppError } from '../../utils/errors.js';
import {
  countUsers,
  createUserRecord,
  findUserByEmail,
  findUserById,
  listUsers,
  updateUser as updateUserRecord,
} from './user.model.js';

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const toSortColumnMap = {
  email: 'email',
  role: 'role',
  isEmailVerified: 'is_email_verified',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const isDuplicateEmailError = (error) => {
  return error?.code === 'USER_EMAIL_CONFLICT' || error?.code === 'ER_DUP_ENTRY';
};

export const sanitizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const createUser = ({ email, passwordHash, role, isEmailVerified }) => {
  const safeRole = role === 'admin' ? 'admin' : 'user';

  return createUserRecord({
    email: normalizeEmail(email),
    passwordHash,
    role: safeRole,
    isEmailVerified,
  }).catch((error) => {
    if (isDuplicateEmailError(error)) {
      throw new AppError('User already registered', 409);
    }
    throw error;
  });
};

export const updateUserById = async (id, updates) => {
  const payload = { ...updates };
  if (payload.email !== undefined) {
    payload.email = normalizeEmail(payload.email);
  }
  try {
    return await updateUserRecord(id, payload);
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      throw new AppError('Email already in use', 409);
    }
    throw error;
  }
};

export const getUserByIdOrThrow = async (id) => {
  const user = await findUserById(id);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
};

export const updateCurrentUserProfile = async ({ userId, email }) => {
  const existing = await getUserByIdOrThrow(userId);
  const updates = {};
  if (email !== undefined) {
    updates.email = normalizeEmail(email);
  }

  if (!Object.keys(updates).length) {
    return sanitizeUser(existing);
  }

  const updated = await updateUserById(userId, updates);
  return sanitizeUser(updated);
};

export const getCurrentUserProfile = async (userId) => {
  const user = await getUserByIdOrThrow(userId);
  return sanitizeUser(user);
};

export const getUserForAdminById = async (id) => {
  const user = await getUserByIdOrThrow(id);
  return sanitizeUser(user);
};

export const listUsersForAdmin = async ({
  page = DEFAULT_PAGE,
  limit = DEFAULT_LIMIT,
  role,
  isEmailVerified,
  search,
  sortBy = 'createdAt',
  sortOrder = 'desc',
} = {}) => {
  const normalizedPage = Math.max(Number(page) || DEFAULT_PAGE, 1);
  const normalizedLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = (normalizedPage - 1) * normalizedLimit;

  const filters = {
    role,
    searchEmail: search ? normalizeEmail(search) : undefined,
    isEmailVerified,
  };
  const resolvedSortBy = toSortColumnMap[sortBy] || toSortColumnMap.createdAt;
  const resolvedSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const [total, users] = await Promise.all([
    countUsers(filters),
    listUsers({
      filters,
      offset,
      limit: normalizedLimit,
      sortBy: resolvedSortBy,
      sortOrder: resolvedSortOrder,
    }),
  ]);

  return {
    users: users.map(sanitizeUser),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages: total > 0 ? Math.ceil(total / normalizedLimit) : 0,
      hasNextPage: offset + users.length < total,
      hasPreviousPage: normalizedPage > 1,
    },
  };
};

export const updateUserByAdmin = async (id, updates) => {
  await getUserByIdOrThrow(id);
  const payload = { ...updates };
  if (payload.email !== undefined) {
    payload.email = normalizeEmail(payload.email);
  }
  const updated = await updateUserById(id, payload);
  return sanitizeUser(updated);
};

export const updateUser = updateUserById;

export { findUserByEmail, findUserById };
