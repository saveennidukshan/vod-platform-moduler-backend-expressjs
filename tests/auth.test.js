import { beforeEach, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import { clearRateLimitBucketsForTests } from '../src/http/middleware/rate-limit.js';
import { resetInMemoryStore } from '../src/infrastructure/persistence/in-memory-store.js';
import { findUserByEmail, updateUser } from '../src/modules/users/user.service.js';
import { hashToken } from '../src/shared/security/crypto.js';
import { signActionToken } from '../src/shared/security/jwt.js';

const authBase = '/api/v1/auth';

const uniqueEmail = () => `vod_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;

const extractCookieValue = (setCookie, name) => {
  const target = (setCookie || []).find((entry) => entry.startsWith(`${name}=`));
  if (!target) return null;
  return target.split(';')[0].split('=')[1];
};

describe('Auth Module', () => {
  beforeEach(() => {
    resetInMemoryStore();
    clearRateLimitBucketsForTests();
  });

  test('register + me returns authenticated user', async () => {
    const email = uniqueEmail();
    const password = 'StrongPass@1234';

    const registerResponse = await request(app)
      .post(`${authBase}/register`)
      .send({ email, password });

    expect(registerResponse.statusCode).toBe(201);
    expect(registerResponse.body.success).toBe(true);
    expect(registerResponse.body.data.accessToken).toBeTruthy();

    const meResponse = await request(app)
      .get(`${authBase}/me`)
      .set('Authorization', 'Bearer ' + registerResponse.body.data.accessToken);

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.body.data.user.email).toBe(email.toLowerCase());
  });

  test('login fails with invalid credentials', async () => {
    const email = uniqueEmail();
    const password = 'StrongPass@1234';

    await request(app).post(`${authBase}/register`).send({ email, password });

    const response = await request(app).post(`${authBase}/login`).send({
      email,
      password: 'WrongPass@1234',
    });

    expect(response.statusCode).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('locked account blocks login after repeated failures', async () => {
    const email = uniqueEmail();
    const password = 'StrongPass@1234';

    await request(app).post(`${authBase}/register`).send({ email, password });

    for (let i = 0; i < 5; i += 1) {
      await request(app).post(`${authBase}/login`).send({ email, password: 'WrongPass@1234' });
    }

    const response = await request(app).post(`${authBase}/login`).send({ email, password });
    expect(response.statusCode).toBe(423);
  }, 15000);

  test('invalid access token is rejected on protected endpoint', async () => {
    const response = await request(app).get(`${authBase}/me`).set('Authorization', '******');

    expect(response.statusCode).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('refresh token rotation detects reuse', async () => {
    const email = uniqueEmail();
    const password = 'StrongPass@1234';
    const agent = request.agent(app);

    const registerResponse = await agent.post(`${authBase}/register`).send({ email, password });
    const firstRefreshToken = extractCookieValue(
      registerResponse.headers['set-cookie'],
      'refreshToken'
    );
    const firstCsrfToken = extractCookieValue(registerResponse.headers['set-cookie'], 'csrfToken');

    const refreshResponse = await agent
      .post(`${authBase}/refresh-token`)
      .set('x-csrf-token', firstCsrfToken)
      .send({});

    expect(refreshResponse.statusCode).toBe(200);

    const reuseResponse = await request(app).post(`${authBase}/refresh-token`).send({
      refreshToken: firstRefreshToken,
    });

    expect(reuseResponse.statusCode).toBe(401);

    const secondCsrfToken =
      extractCookieValue(refreshResponse.headers['set-cookie'], 'csrfToken') || firstCsrfToken;
    const revokedFamilyResponse = await agent
      .post(`${authBase}/refresh-token`)
      .set('x-csrf-token', secondCsrfToken)
      .send({});

    expect(revokedFamilyResponse.statusCode).toBe(401);
  });

  test('expired reset token is rejected', async () => {
    const email = uniqueEmail();
    const password = 'StrongPass@1234';

    await request(app).post(`${authBase}/register`).send({ email, password });

    const user = await findUserByEmail(email.toLowerCase());
    const token = signActionToken(
      { sub: user.id, purpose: 'reset_password', tokenVersion: user.tokenVersion },
      '10m'
    );

    await updateUser(user.id, {
      resetPasswordTokenHash: hashToken(token),
      resetPasswordExpiresAt: new Date(Date.now() - 1000),
    });

    const response = await request(app).post(`${authBase}/reset-password`).send({
      token,
      newPassword: 'NewStrongPass@1234',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
