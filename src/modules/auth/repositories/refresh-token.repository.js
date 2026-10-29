import { db, hasDatabase } from '../../../infrastructure/database/mysql.js';
import { inMemoryRefreshTokens } from '../../../infrastructure/persistence/in-memory-store.js';

let initialized = false;

const mapTokenRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    tokenJti: row.token_jti,
    tokenFamily: row.token_family,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    replacedByJti: row.replaced_by_jti,
    createdIp: row.created_ip,
    userAgent: row.user_agent,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
};

export const initRefreshTokensTable = async () => {
  if (!hasDatabase || initialized) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id VARCHAR(36) NOT NULL,
      token_jti VARCHAR(64) NOT NULL UNIQUE,
      token_family VARCHAR(64) NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      replaced_by_jti VARCHAR(64) NULL,
      created_ip VARCHAR(128) NULL,
      user_agent TEXT NULL,
      created_at DATETIME NOT NULL,
      INDEX idx_user_id (user_id),
      INDEX idx_token_family (token_family)
    )
  `);
  initialized = true;
};

export const saveRefreshToken = async (token) => {
  await initRefreshTokensTable();
  if (!hasDatabase) {
    inMemoryRefreshTokens.set(token.tokenJti, { ...token });
    return { ...token };
  }

  await db.execute(
    `INSERT INTO refresh_tokens (user_id, token_jti, token_family, token_hash, expires_at, revoked_at, replaced_by_jti, created_ip, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      token.userId,
      token.tokenJti,
      token.tokenFamily,
      token.tokenHash,
      token.expiresAt,
      token.revokedAt,
      token.replacedByJti,
      token.createdIp,
      token.userAgent,
      token.createdAt,
    ]
  );

  return token;
};

export const findRefreshTokenByJti = async (jti) => {
  await initRefreshTokensTable();
  if (!hasDatabase) {
    const token = inMemoryRefreshTokens.get(jti);
    return token ? { ...token } : null;
  }

  const [rows] = await db.execute('SELECT * FROM refresh_tokens WHERE token_jti = ? LIMIT 1', [
    jti,
  ]);
  return mapTokenRow(rows[0]);
};

export const revokeRefreshTokenByJti = async (jti, replacedByJti = null) => {
  await initRefreshTokensTable();
  const revokedAt = new Date();

  if (!hasDatabase) {
    const token = inMemoryRefreshTokens.get(jti);
    if (!token) return null;
    const updated = {
      ...token,
      revokedAt,
      replacedByJti: replacedByJti || token.replacedByJti,
    };
    inMemoryRefreshTokens.set(jti, updated);
    return { ...updated };
  }

  await db.execute(
    'UPDATE refresh_tokens SET revoked_at = ?, replaced_by_jti = ? WHERE token_jti = ?',
    [revokedAt, replacedByJti, jti]
  );
  return findRefreshTokenByJti(jti);
};

export const revokeRefreshTokenFamily = async (family) => {
  await initRefreshTokensTable();
  const revokedAt = new Date();

  if (!hasDatabase) {
    for (const [jti, token] of inMemoryRefreshTokens.entries()) {
      if (token.tokenFamily === family && !token.revokedAt) {
        inMemoryRefreshTokens.set(jti, {
          ...token,
          revokedAt,
        });
      }
    }
    return;
  }

  await db.execute(
    'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE token_family = ?',
    [revokedAt, family]
  );
};

export const revokeRefreshTokensByUserId = async (userId) => {
  await initRefreshTokensTable();
  const revokedAt = new Date();

  if (!hasDatabase) {
    for (const [jti, token] of inMemoryRefreshTokens.entries()) {
      if (token.userId === userId && !token.revokedAt) {
        inMemoryRefreshTokens.set(jti, {
          ...token,
          revokedAt,
        });
      }
    }
    return;
  }

  await db.execute(
    'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE user_id = ?',
    [revokedAt, userId]
  );
};
