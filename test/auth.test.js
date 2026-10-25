import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB, app, User } from './helpers.js';
import { AUTH_COOKIE_NAME } from '../src/utils/authCookie.js';

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();
});

test('Auth: Register creates user with role "user" and sets httpOnly cookie, body has no token', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Alice User',
      email: 'alice@example.com',
      password: 'Password123!'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.user.name, 'Alice User');
  assert.equal(res.body.user.email, 'alice@example.com');
  assert.equal(res.body.user.role, 'user');
  assert.equal(res.body.token, undefined, 'Token must NEVER be in response body');
  assert.equal(res.body.user.passwordHash, undefined, 'passwordHash must NEVER be returned');

  const cookies = res.headers['set-cookie'];
  assert.ok(cookies, 'Cookie must be set');
  const authCookie = cookies.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
  assert.ok(authCookie, 'access_token cookie must be present');
  assert.match(authCookie, /HttpOnly/i, 'Cookie must be HttpOnly');
  assert.match(authCookie, /SameSite=Lax/i, 'Cookie must be SameSite=Lax');
});

test('Auth: Register rejects attempts to elevate role to admin via request body', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Hacker',
      email: 'hacker@example.com',
      password: 'Password123!',
      role: 'admin' // Attempting to pass role
    });

  // Zod .strict() rejects unrecognized key 'role'
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('Auth: Login returns 401 with identical message for wrong password and non-existent email', async () => {
  // First register a valid user
  await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'CorrectPassword123!'
    });

  // 1. Non-existent email
  const resUnknown = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'nonexistent@example.com',
      password: 'SomePassword123!'
    });

  // 2. Wrong password on existing email
  const resWrongPass = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'bob@example.com',
      password: 'WrongPassword123!'
    });

  assert.equal(resUnknown.status, 401);
  assert.equal(resWrongPass.status, 401);
  assert.equal(resUnknown.body.error.message, 'Invalid credentials');
  assert.equal(resWrongPass.body.error.message, 'Invalid credentials');
  assert.equal(resUnknown.body.error.code, resWrongPass.body.error.code);
});

test('Auth: Deleted user old cookie returns 401 on authenticated routes', async () => {
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Temporary User',
      email: 'temp@example.com',
      password: 'Password123!'
    });

  const cookie = regRes.headers['set-cookie'];

  // Delete user directly from DB
  await User.deleteOne({ email: 'temp@example.com' });

  // Verify authenticate rejects deleted user
  const { authenticate } = await import('../src/middleware/auth.js');
  const { errorHandler } = await import('../src/middleware/errorHandler.js');
  const express = (await import('express')).default;
  const cookieParser = (await import('cookie-parser')).default;

  const testApp = express();
  testApp.use(cookieParser());
  testApp.get('/test-auth', authenticate, (req, res) => res.json({ ok: true }));
  testApp.use(errorHandler);

  const testRes = await request(testApp)
    .get('/test-auth')
    .set('Cookie', cookie);

  assert.equal(testRes.status, 401);
  assert.equal(testRes.body.error.code, 'UNAUTHORIZED');
});

test('Auth: Logout clears the auth cookie', async () => {
  const res = await request(app).post('/api/auth/logout');
  assert.equal(res.status, 204);

  const cookies = res.headers['set-cookie'];
  assert.ok(cookies);
  const clearedCookie = cookies.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
  assert.ok(clearedCookie);
  // Cleared cookies typically have expires in past or empty value
  assert.ok(clearedCookie.includes('Expires=') || clearedCookie.includes('Max-Age=0'));
});

test('CSRF: Mutating request with foreign Origin header returns 403', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', 'https://malicious-attacker.com')
    .send({
      email: 'any@example.com',
      password: 'Password123!'
    });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'CSRF_BLOCKED');
});
