import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB, app, User, Note, Post } from './helpers.js';
import { signToken } from '../src/utils/authCookie.js';

let adminUser;
let adminCookie;
let targetUser;

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();

  adminUser = await User.create({
    name: 'Super Admin',
    email: 'superadmin@example.com',
    passwordHash: 'dummy',
    role: 'admin'
  });
  adminCookie = `access_token=${signToken(adminUser)}`;

  targetUser = await User.create({
    name: 'Target User',
    email: 'target@example.com',
    passwordHash: 'dummy',
    role: 'user'
  });
});

test('Admin: Admin cannot delete or demote their own account', async () => {
  // Try self-demote
  const demoteRes = await request(app)
    .patch(`/api/admin/users/${adminUser._id}`)
    .set('Cookie', adminCookie)
    .send({ role: 'user' });

  assert.equal(demoteRes.status, 400);
  assert.match(demoteRes.body.error.message, /cannot demote/i);

  // Try self-delete
  const deleteRes = await request(app)
    .delete(`/api/admin/users/${adminUser._id}`)
    .set('Cookie', adminCookie);

  assert.equal(deleteRes.status, 400);
  assert.match(deleteRes.body.error.message, /cannot delete/i);
});

test('Admin: Deleting a user cascade-removes their notes and posts', async () => {
  // Create notes and posts belonging to targetUser
  await Note.create({ owner: targetUser._id, title: 'Note 1', content: 'C1' });
  await Note.create({ owner: targetUser._id, title: 'Note 2', content: 'C2' });
  await Post.create({ author: targetUser._id, title: 'Post 1', content: 'P1' });

  // Delete targetUser via admin endpoint
  const delRes = await request(app)
    .delete(`/api/admin/users/${targetUser._id}`)
    .set('Cookie', adminCookie);

  assert.equal(delRes.status, 204);

  // Assert user is gone
  const userInDb = await User.findById(targetUser._id);
  assert.equal(userInDb, null);

  // Assert notes are cascade deleted
  const remainingNotes = await Note.find({ owner: targetUser._id });
  assert.equal(remainingNotes.length, 0);

  // Assert posts are cascade deleted
  const remainingPosts = await Post.find({ author: targetUser._id });
  assert.equal(remainingPosts.length, 0);
});

test('Admin: Creating user with duplicate email returns 409 Conflict', async () => {
  const res = await request(app)
    .post('/api/admin/users')
    .set('Cookie', adminCookie)
    .send({
      name: 'Duplicate Guy',
      email: 'target@example.com', // Already taken by targetUser
      password: 'Password123!',
      role: 'user'
    });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CONFLICT');
});
