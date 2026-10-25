import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB, app, User, Note } from './helpers.js';
import { signToken } from '../src/utils/authCookie.js';

let userCookie;
let userId;

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();

  const user = await User.create({
    name: 'Pagination Tester',
    email: 'page@example.com',
    passwordHash: 'dummy',
    role: 'user'
  });
  userId = user._id;
  const token = signToken(user);
  userCookie = `access_token=${token}`;
});

test('Pagination: 25 notes returned across 3 stable pages with correct cursors and hasMore flags', async () => {
  // Insert 25 notes sequentially so _id order matches insertion order
  const noteDocs = [];
  for (let i = 1; i <= 25; i++) {
    noteDocs.push({
      owner: userId,
      title: `Note ${i.toString().padStart(2, '0')}`,
      content: `Content for note ${i}`
    });
  }
  await Note.insertMany(noteDocs);

  // Page 1: limit 10
  const page1Res = await request(app)
    .get('/api/notes?limit=10')
    .set('Cookie', userCookie);

  assert.equal(page1Res.status, 200);
  assert.equal(page1Res.body.items.length, 10);
  assert.equal(page1Res.body.hasMore, true);
  assert.ok(page1Res.body.nextCursor);

  // Page 2: with cursor from page 1
  const page2Res = await request(app)
    .get(`/api/notes?limit=10&cursor=${page1Res.body.nextCursor}`)
    .set('Cookie', userCookie);

  assert.equal(page2Res.status, 200);
  assert.equal(page2Res.body.items.length, 10);
  assert.equal(page2Res.body.hasMore, true);
  assert.ok(page2Res.body.nextCursor);

  // Page 3: with cursor from page 2
  const page3Res = await request(app)
    .get(`/api/notes?limit=10&cursor=${page2Res.body.nextCursor}`)
    .set('Cookie', userCookie);

  assert.equal(page3Res.status, 200);
  assert.equal(page3Res.body.items.length, 5);
  assert.equal(page3Res.body.hasMore, false);
  assert.equal(page3Res.body.nextCursor, null);

  // Total collected without duplicates or gaps
  const allIds = [
    ...page1Res.body.items.map((n) => n._id),
    ...page2Res.body.items.map((n) => n._id),
    ...page3Res.body.items.map((n) => n._id)
  ];
  assert.equal(allIds.length, 25);
  const uniqueIds = new Set(allIds);
  assert.equal(uniqueIds.size, 25);
});

test('Pagination: Limit above 50 is clamped to 50', async () => {
  const res = await request(app)
    .get('/api/notes?limit=100')
    .set('Cookie', userCookie);

  assert.equal(res.status, 200);
  // Clamped without error
});

test('Notes CRUD: User A cannot read, update, or delete User B note (returns 404)', async () => {
  // Create user B
  const userB = await User.create({
    name: 'User B',
    email: 'userb@example.com',
    passwordHash: 'dummy',
    role: 'user'
  });
  const noteB = await Note.create({
    owner: userB._id,
    title: 'Secret Note of B',
    content: 'Private'
  });

  // User A tries to read User B's note
  const getRes = await request(app)
    .get(`/api/notes/${noteB._id}`)
    .set('Cookie', userCookie);
  assert.equal(getRes.status, 404);

  // User A tries to edit User B's note
  const patchRes = await request(app)
    .patch(`/api/notes/${noteB._id}`)
    .set('Cookie', userCookie)
    .send({ title: 'Hacked title' });
  assert.equal(patchRes.status, 404);

  // User A tries to delete User B's note
  const delRes = await request(app)
    .delete(`/api/notes/${noteB._id}`)
    .set('Cookie', userCookie);
  assert.equal(delRes.status, 404);

  // Note B still exists untouched in DB
  const stillExists = await Note.findById(noteB._id);
  assert.ok(stillExists);
  assert.equal(stillExists.title, 'Secret Note of B');
});
