import crypto from 'crypto';
import { hasDatabase, prisma } from '../../../infrastructure/database/prisma.js';
import { inMemoryUsers } from '../../../infrastructure/persistence/in-memory-store.js';

const DEFAULT_SORT_COLUMN = 'createdAt';
const ALLOWED_SORT_COLUMNS = new Set([
  'email',
  'role',
  'isEmailVerified',
  'createdAt',
  'updatedAt',
]);

const createDuplicateEmailError = () => {
  const error = new Error('User email already exists');
  error.code = 'USER_EMAIL_CONFLICT';
  return error;
};

const mapUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    failedLoginAttempts: user.failedLoginAttempts,
    lockUntil: user.lockUntil,
    passwordChangedAt: user.passwordChangedAt,
    tokenVersion: user.tokenVersion,
    resetPasswordTokenHash: user.resetPasswordTokenHash,
    resetPasswordExpiresAt: user.resetPasswordExpiresAt,
    emailVerificationTokenHash: user.emailVerificationTokenHash,
    emailVerificationExpiresAt: user.emailVerificationExpiresAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const isUniqueConstraintError = (error) => error?.code === 'P2002';

export const initUsersTable = async () => {
  if (hasDatabase) await prisma.$connect();
};

export const createUserRecord = async ({
  email,
  passwordHash,
  role = 'user',
  isEmailVerified = false,
}) => {
  await initUsersTable();
  const user = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
    role,
    isEmailVerified,
    failedLoginAttempts: 0,
    lockUntil: null,
    passwordChangedAt: null,
    tokenVersion: 0,
    resetPasswordTokenHash: null,
    resetPasswordExpiresAt: null,
    emailVerificationTokenHash: null,
    emailVerificationExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!hasDatabase) {
    if (inMemoryUsers.has(email)) throw createDuplicateEmailError();
    inMemoryUsers.set(email, user);
    return { ...user };
  }

  try {
    return mapUser(await prisma.userAuth.create({ data: user }));
  } catch (error) {
    if (isUniqueConstraintError(error)) throw createDuplicateEmailError();
    throw error;
  }
};

export const findUserByEmail = async (email) => {
  await initUsersTable();
  if (!hasDatabase) {
    const user = inMemoryUsers.get(email);
    return user ? { ...user } : null;
  }
  return mapUser(await prisma.userAuth.findUnique({ where: { email } }));
};

export const findUserById = async (id) => {
  await initUsersTable();
  if (!hasDatabase) {
    for (const user of inMemoryUsers.values()) {
      if (user.id === id) return { ...user };
    }
    return null;
  }
  return mapUser(await prisma.userAuth.findUnique({ where: { id } }));
};

export const updateUser = async (id, updates) => {
  await initUsersTable();

  if (!hasDatabase) {
    let existing;
    let existingKey;
    for (const [key, value] of inMemoryUsers.entries()) {
      if (value.id === id) {
        existing = value;
        existingKey = key;
        break;
      }
    }
    if (!existing) return null;
    const merged = { ...existing, ...updates, updatedAt: new Date() };
    const nextKey = merged.email;
    const conflicting = nextKey !== existingKey ? inMemoryUsers.get(nextKey) : null;
    if (conflicting && conflicting.id !== id) throw createDuplicateEmailError();
    inMemoryUsers.delete(existingKey);
    inMemoryUsers.set(nextKey, merged);
    return { ...merged };
  }

  try {
    return mapUser(
      await prisma.userAuth.update({
        where: { id },
        data: { ...updates, updatedAt: new Date() },
      })
    );
  } catch (error) {
    if (error?.code === 'P2025') return null;
    if (isUniqueConstraintError(error)) throw createDuplicateEmailError();
    throw error;
  }
};

const buildWhere = (filters = {}) => ({
  ...(filters.searchEmail ? { email: { contains: filters.searchEmail, mode: 'insensitive' } } : {}),
  ...(filters.role ? { role: filters.role } : {}),
  ...(typeof filters.isEmailVerified === 'boolean'
    ? { isEmailVerified: filters.isEmailVerified }
    : {}),
});

const filterUsersInMemory = (filters = {}) =>
  [...inMemoryUsers.values()].filter((user) => {
    if (filters.searchEmail && !user.email.includes(filters.searchEmail)) return false;
    if (filters.role && user.role !== filters.role) return false;
    if (
      typeof filters.isEmailVerified === 'boolean' &&
      user.isEmailVerified !== filters.isEmailVerified
    )
      return false;
    return true;
  });

export const countUsers = async (filters = {}) => {
  await initUsersTable();
  if (!hasDatabase) return filterUsersInMemory(filters).length;
  return prisma.userAuth.count({ where: buildWhere(filters) });
};

export const listUsers = async ({
  filters = {},
  offset = 0,
  limit = 20,
  sortBy = DEFAULT_SORT_COLUMN,
  sortOrder = 'DESC',
} = {}) => {
  await initUsersTable();
  const selectedSortBy = ALLOWED_SORT_COLUMNS.has(sortBy) ? sortBy : DEFAULT_SORT_COLUMN;
  const direction = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

  if (!hasDatabase) {
    const sorted = filterUsersInMemory(filters).sort((first, second) => {
      const firstValue = first[selectedSortBy];
      const secondValue = second[selectedSortBy];
      if (firstValue === secondValue) return 0;
      const result = firstValue > secondValue ? 1 : -1;
      return direction === 'asc' ? result : -result;
    });
    return sorted.slice(offset, offset + limit).map((user) => ({ ...user }));
  }

  const users = await prisma.userAuth.findMany({
    where: buildWhere(filters),
    orderBy: { [selectedSortBy]: direction },
    skip: offset,
    take: limit,
  });
  return users.map(mapUser);
};
