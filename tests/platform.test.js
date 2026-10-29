import { describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('Platform hardening', () => {
  test('exposes liveness and propagates a safe request id', async () => {
    const requestId = 'test-request-123';
    const response = await request(app).get('/health/live').set('x-request-id', requestId);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.headers['x-request-id']).toBe(requestId);
  });

  test('rejects malformed JSON without exposing parser internals', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('content-type', 'application/json')
      .send('{"email":');

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Malformed request body');
    expect(response.body.message).not.toContain('Unexpected');
    expect(response.body.requestId).toBeTruthy();
  });

  test('returns a consistent not-found response', async () => {
    const response = await request(app).get('/not-a-real-route');

    expect(response.statusCode).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Route not found',
    });
  });
});
