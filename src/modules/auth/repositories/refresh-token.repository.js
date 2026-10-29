import { hasDatabase, prisma } from '../../../infrastructure/database/prisma.js';
import { inMemoryRefreshTokens } from '../../../infrastructure/persistence/in-memory-store.js';

const mapToken = (token) => {
  if (!token) return null;
  return {
    id: token.id,
    userId: token.userId,
    tokenJti: token.tokenJti,
    tokenFamily: token.tokenFamily,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    replacedByJti: token.replacedByJti,
    createdIp: token.createdIp,
    userAgent: token.userAgent,
    createdAt: token.createdAt,
  };
};

export const initRefreshTokensTable = async () => {
  if (hasDatabase) await prisma.$connect();
};

export const saveRefreshToken = async (token) => {
  await initRefreshTokensTable();
  if (!hasDatabase) {
    inMemoryRefreshTokens.set(token.tokenJti, { ...token });
    return { ...token };
  }
  return mapToken(await prisma.refreshToken.create({ data: token }));
};

export const findRefreshTokenByJti = async (jti) => {
  await initRefreshTokensTable();
  if (!hasDatabase) {
    const token = inMemoryRefreshTokens.get(jti);
    return token ? { ...token } : null;
  }
  return mapToken(await prisma.refreshToken.findUnique({ where: { tokenJti: jti } }));
};

export const revokeRefreshTokenByJti = async (jti, replacedByJti = null) => {
  await initRefreshTokensTable();
  const revokedAt = new Date();
  if (!hasDatabase) {
    const token = inMemoryRefreshTokens.get(jti);
    if (!token) return null;
    const updated = { ...token, revokedAt, replacedByJti: replacedByJti || token.replacedByJti };
    inMemoryRefreshTokens.set(jti, updated);
    return { ...updated };
  }
  try {
    return mapToken(
      await prisma.refreshToken.update({
        where: { tokenJti: jti },
        data: { revokedAt, replacedByJti },
      })
    );
  } catch (error) {
    if (error?.code === 'P2025') return null;
    throw error;
  }
};

export const revokeRefreshTokenFamily = async (family) => {
  await initRefreshTokensTable();
  const revokedAt = new Date();
  if (!hasDatabase) {
    for (const [jti, token] of inMemoryRefreshTokens.entries()) {
      if (token.tokenFamily === family && !token.revokedAt) {
        inMemoryRefreshTokens.set(jti, { ...token, revokedAt });
      }
    }
    return;
  }
  await prisma.refreshToken.updateMany({
    where: { tokenFamily: family, revokedAt: null },
    data: { revokedAt },
  });
};

export const revokeRefreshTokensByUserId = async (userId) => {
  await initRefreshTokensTable();
  const revokedAt = new Date();
  if (!hasDatabase) {
    for (const [jti, token] of inMemoryRefreshTokens.entries()) {
      if (token.userId === userId && !token.revokedAt) {
        inMemoryRefreshTokens.set(jti, { ...token, revokedAt });
      }
    }
    return;
  }
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt },
  });
};
