import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB, app, User, Post } from './helpers.js';
import { signToken } from '../src/utils/authCookie.js';

let userCookie;
let testUser;

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();

  testUser = await User.create({
    name: 'Main Tester',
    email: 'tester@example.com',
    passwordHash: 'dummy',
    role: 'user',
    interests: ['chess', 'reading']
  });
  userCookie = `access_token=${signToken(testUser)}`;
});

test('Scenario 1 (Group by Interests): Case insensitive grouping, filtering, and count accuracy', async () => {
  // Create users with varied capitalization and overlapping interests
  await User.create([
    { name: 'U1', email: 'u1@ex.com', passwordHash: 'h', role: 'user', interests: ['Chess', 'gaming'] },
    { name: 'U2', email: 'u2@ex.com', passwordHash: 'h', role: 'user', interests: ['chess', 'Reading'] },
    { name: 'U3', email: 'u3@ex.com', passwordHash: 'h', role: 'user', interests: ['cooking'] }
  ]);

  // 1. All groups
  const allRes = await request(app)
    .get('/api/interests')
    .set('Cookie', userCookie);

  assert.equal(allRes.status, 200);
  assert.ok(Array.isArray(allRes.body.groups));

  // 'Chess' and 'chess' must have normalized into a single 'chess' group
  const chessGroup = allRes.body.groups.find((g) => g.interest === 'chess');
  assert.ok(chessGroup, 'Group "chess" must exist');
  // testUser + U1 + U2 = 3 users
  assert.equal(chessGroup.count, 3);
  assert.equal(chessGroup.users.length, 3);

  // 2. Filter by specific interest: ?interest=chess
  const filteredRes = await request(app)
    .get('/api/interests?interest=chess')
    .set('Cookie', userCookie);

  assert.equal(filteredRes.status, 200);
  assert.equal(filteredRes.body.groups.length, 1);
  assert.equal(filteredRes.body.groups[0].interest, 'chess');
  assert.equal(filteredRes.body.groups[0].count, 3);
  assert.equal(filteredRes.body.totalGroups, 1);

  // 3. User privacy check: password fields and email must never be exposed in group projection
  const previewUser = chessGroup.users[0];
  assert.equal(previewUser.email, undefined);
  assert.equal(previewUser.passwordHash, undefined);
  assert.ok(previewUser._id);
  assert.ok(previewUser.name);
});

test('Scenario 2 (User Posts via $lookup): Returns 404 for unknown user, paginates without duplicates', async () => {
  // Unknown ID returns 404
  const unknownId = '660000000000000000000099';
  const notFoundRes = await request(app).get(`/api/users/${unknownId}/posts`);
  assert.equal(notFoundRes.status, 404);

  // Create 15 posts for testUser
  const posts = [];
  for (let i = 1; i <= 15; i++) {
    posts.push({
      author: testUser._id,
      title: `Post ${i.toString().padStart(2, '0')}`,
      content: `Post content ${i}`
    });
  }
  await Post.insertMany(posts);

  // Page 1: limit 10
  const page1 = await request(app).get(`/api/users/${testUser._id}/posts?limit=10`);
  assert.equal(page1.status, 200);
  assert.equal(page1.body.user.name, 'Main Tester');
  assert.equal(page1.body.posts.length, 10);
  assert.equal(page1.body.hasMore, true);
  assert.ok(page1.body.nextCursor);

  // Page 2: with cursor
  const page2 = await request(app).get(`/api/users/${testUser._id}/posts?limit=10&cursor=${page1.body.nextCursor}`);
  assert.equal(page2.status, 200);
  assert.equal(page2.body.posts.length, 5);
  assert.equal(page2.body.hasMore, false);
  assert.equal(page2.body.nextCursor, null);

  // Check no duplicates across pages
  const allPostIds = [
    ...page1.body.posts.map((p) => p._id),
    ...page2.body.posts.map((p) => p._id)
  ];
  assert.equal(allPostIds.length, 15);
  const uniquePostIds = new Set(allPostIds);
  assert.equal(uniquePostIds.size, 15);
});
