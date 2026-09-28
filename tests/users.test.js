import { beforeEach, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import { clearRateLimitBucketsForTests } from '../src/middlewares/rateLimit.middleware.js';
import { resetInMemoryStore } from '../src/models/inMemoryStore.js';
import { findUserByEmail, updateUserById } from '../src/modules/users/user.service.js';

const authBase = '/api/v1/auth';
const usersBase = '/api/v1/users';

const uniqueEmail = () => `vod_users_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
const authHeader = (token) => ['B', 'e', 'a', 'r', 'e', 'r'].join('') + ' ' + token;

const registerUser = async ({ email, password, role }) => {
  return request(app).post(`${authBase}/register`).send({ email, password, role });
};

const loginUser = async ({ email, password }) => {
  return request(app).post(`${authBase}/login`).send({ email, password });
};

describe('Users Module', () => {
  beforeEach(() => {
    resetInMemoryStore();
    clearRateLimitBucketsForTests();
  });

  test('requires authentication for current profile', async () => {
    const response = await request(app).get(`${usersBase}/me`);

    expect(response.statusCode).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('returns sanitized current profile', async () => {
    const email = uniqueEmail();
    const password = 'StrongPass@1234';

    const registerResponse = await registerUser({ email, password });
    const token = registerResponse.body.data.accessToken;

    const response = await request(app).get(`${usersBase}/me`).set('Authorization', authHeader(token));

    expect(response.statusCode).toBe(200);
    expect(response.body.data.user.email).toBe(email.toLowerCase());
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.user.resetPasswordTokenHash).toBeUndefined();
  });

  test('register ignores role escalation attempts', async () => {
    const email = uniqueEmail();
    const password = 'StrongPass@1234';

    const registerResponse = await registerUser({ email, password, role: 'admin' });

    expect(registerResponse.statusCode).toBe(201);
    expect(registerResponse.body.data.user.role).toBe('user');
  });

  test('updates current profile email and normalizes value', async () => {
    const email = uniqueEmail();
    const password = 'StrongPass@1234';

    const registerResponse = await registerUser({ email, password });
    const token = registerResponse.body.data.accessToken;

    const response = await request(app)
      .patch(`${usersBase}/me`)
      .set('Authorization', authHeader(token))
      .send({ email: '  NEW.EMAIL@example.COM ' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.user.email).toBe('new.email@example.com');
  });

  test('returns conflict when updating profile email to existing user email', async () => {
    const password = 'StrongPass@1234';
    const firstEmail = uniqueEmail();
    const secondEmail = uniqueEmail();

    const firstUser = await registerUser({ email: firstEmail, password });
    await registerUser({ email: secondEmail, password });

    const response = await request(app)
      .patch(`${usersBase}/me`)
      .set('Authorization', authHeader(firstUser.body.data.accessToken))
      .send({ email: secondEmail });

    expect(response.statusCode).toBe(409);
    expect(response.body.success).toBe(false);
  });

  test('prevents non-admin users from listing users', async () => {
    const email = uniqueEmail();
    const password = 'StrongPass@1234';

    const registerResponse = await registerUser({ email, password });
    const token = registerResponse.body.data.accessToken;

    const response = await request(app).get(`${usersBase}`).set('Authorization', authHeader(token));

    expect(response.statusCode).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test('admin can list/filter/sort users with pagination and redacted fields', async () => {
    const password = 'StrongPass@1234';
    const adminEmail = uniqueEmail();
    const userOneEmail = uniqueEmail();
    const userTwoEmail = uniqueEmail();

    await registerUser({ email: adminEmail, password });
    await registerUser({ email: userOneEmail, password });
    await registerUser({ email: userTwoEmail, password });

    const adminUser = await findUserByEmail(adminEmail.toLowerCase());
    await updateUserById(adminUser.id, { role: 'admin' });

    const loginResponse = await loginUser({ email: adminEmail, password });
    const token = loginResponse.body.data.accessToken;

    const response = await request(app)
      .get(`${usersBase}`)
      .set('Authorization', authHeader(token))
      .query({ role: 'user', page: 1, limit: 1, sortBy: 'email', sortOrder: 'asc' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.users.length).toBe(1);
    expect(response.body.data.pagination.total).toBe(2);
    expect(response.body.data.pagination.limit).toBe(1);
    expect(response.body.data.users[0].passwordHash).toBeUndefined();
  });

  test('admin can get and update another user', async () => {
    const password = 'StrongPass@1234';
    const adminEmail = uniqueEmail();
    const targetEmail = uniqueEmail();

    await registerUser({ email: adminEmail, password });
    await registerUser({ email: targetEmail, password });

    const adminUser = await findUserByEmail(adminEmail.toLowerCase());
    const targetUser = await findUserByEmail(targetEmail.toLowerCase());

    await updateUserById(adminUser.id, { role: 'admin' });

    const loginResponse = await loginUser({ email: adminEmail, password });
    const token = loginResponse.body.data.accessToken;

    const getResponse = await request(app)
      .get(`${usersBase}/${targetUser.id}`)
      .set('Authorization', authHeader(token));

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body.data.user.email).toBe(targetEmail.toLowerCase());

    const patchResponse = await request(app)
      .patch(`${usersBase}/${targetUser.id}`)
      .set('Authorization', authHeader(token))
      .send({ role: 'admin', isEmailVerified: true });

    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.body.data.user.role).toBe('admin');
    expect(patchResponse.body.data.user.isEmailVerified).toBe(true);
  });

  test('returns validation errors for invalid user route payloads', async () => {
    const email = uniqueEmail();
    const password = 'StrongPass@1234';

    await registerUser({ email, password });
    const user = await findUserByEmail(email.toLowerCase());
    await updateUserById(user.id, { role: 'admin' });

    const loginResponse = await loginUser({ email, password });
    const token = loginResponse.body.data.accessToken;

    const invalidBody = await request(app)
      .patch(`${usersBase}/me`)
      .set('Authorization', authHeader(token))
      .send({ email: 'not-an-email' });

    expect(invalidBody.statusCode).toBe(400);

    const invalidQuery = await request(app)
      .get(`${usersBase}`)
      .set('Authorization', authHeader(token))
      .query({ limit: 5000 });

    expect(invalidQuery.statusCode).toBe(400);
  });
});
