import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB, app, User, Note } from './helpers.js';
import { signToken } from '../src/utils/authCookie.js';

let normalUserCookie;
let adminCookie;
let normalUser;
let otherUser;
let otherNote;

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();

  normalUser = await User.create({
    name: 'Regular User',
    email: 'user@example.com',
    passwordHash: 'dummy',
    role: 'user'
  });
  normalUserCookie = `access_token=${signToken(normalUser)}`;

  const adminUser = await User.create({
    name: 'Site Admin',
    email: 'admin@example.com',
    passwordHash: 'dummy',
    role: 'admin'
  });
  adminCookie = `access_token=${signToken(adminUser)}`;

  otherUser = await User.create({
    name: 'Other Person',
    email: 'other@example.com',
    passwordHash: 'dummy',
    role: 'user'
  });

  otherNote = await Note.create({
    owner: otherUser._id,
    title: 'Other Title',
    content: 'Other Content'
  });
});

test('RBAC: Normal user receives 403 Forbidden on all /api/admin endpoints', async () => {
  const adminEndpoints = [
    { method: 'get', url: '/api/admin/users' },
    { method: 'post', url: '/api/admin/users', body: { name: 'X', email: 'x@x.com', password: 'Password123!' } },
    { method: 'get', url: `/api/admin/users/${otherUser._id}` },
    { method: 'patch', url: `/api/admin/users/${otherUser._id}`, body: { name: 'New' } },
    { method: 'delete', url: `/api/admin/users/${otherUser._id}` },
    { method: 'get', url: '/api/admin/notes' }
  ];

  for (const ep of adminEndpoints) {
    const req = request(app)[ep.method](ep.url).set('Cookie', normalUserCookie);
    if (ep.body) req.send(ep.body);
    const res = await req;
    assert.equal(res.status, 403, `Expected 403 on ${ep.method.toUpperCase()} ${ep.url}`);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  }
});

test('RBAC: Admin can view any user note, but CANNOT edit or delete another user note via /notes/:id', async () => {
  // 1. Admin can read other user's note
  const readRes = await request(app)
    .get(`/api/notes/${otherNote._id}`)
    .set('Cookie', adminCookie);

  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.note.title, 'Other Title');

  // 2. Admin cannot edit other user's note via /notes/:id (ownership strictly required)
  const patchRes = await request(app)
    .patch(`/api/notes/${otherNote._id}`)
    .set('Cookie', adminCookie)
    .send({ title: 'Admin Tampered Title' });

  assert.equal(patchRes.status, 404);

  // 3. Admin cannot delete other user's note via /notes/:id
  const delRes = await request(app)
    .delete(`/api/notes/${otherNote._id}`)
    .set('Cookie', adminCookie);

  assert.equal(delRes.status, 404);
});
