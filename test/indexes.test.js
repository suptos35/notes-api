import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDB, teardownTestDB, User, Note, Post } from './helpers.js';

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

test('Indexes budget: exact index key sets verified across all collections', async () => {
  const userIndexes = await User.collection.indexes();
  const noteIndexes = await Note.collection.indexes();
  const postIndexes = await Post.collection.indexes();

  // Exactly 3 indexes for User: _id_, email_1, interests_1
  assert.equal(userIndexes.length, 3, 'User collection must have exactly 3 indexes (including _id_)');
  
  const userKeys = userIndexes.map((idx) => JSON.stringify(idx.key));
  assert.ok(userKeys.includes(JSON.stringify({ _id: 1 })), 'User must have _id_ index');
  assert.ok(userKeys.includes(JSON.stringify({ email: 1 })), 'User must have email: 1 index');
  assert.ok(userKeys.includes(JSON.stringify({ interests: 1 })), 'User must have interests: 1 index');

  const emailIdx = userIndexes.find((idx) => idx.name === 'email_1');
  assert.equal(emailIdx?.unique, true, 'User email index must be unique');

  // Exactly 2 indexes for Note: _id_, owner_1__id_-1
  assert.equal(noteIndexes.length, 2, 'Note collection must have exactly 2 indexes (including _id_)');
  const noteKeys = noteIndexes.map((idx) => JSON.stringify(idx.key));
  assert.ok(noteKeys.includes(JSON.stringify({ _id: 1 })), 'Note must have _id_ index');
  assert.ok(noteKeys.includes(JSON.stringify({ owner: 1, _id: -1 })), 'Note must have compound {owner: 1, _id: -1} index');

  // Exactly 2 indexes for Post: _id_, author_1__id_-1
  assert.equal(postIndexes.length, 2, 'Post collection must have exactly 2 indexes (including _id_)');
  const postKeys = postIndexes.map((idx) => JSON.stringify(idx.key));
  assert.ok(postKeys.includes(JSON.stringify({ _id: 1 })), 'Post must have _id_ index');
  assert.ok(postKeys.includes(JSON.stringify({ author: 1, _id: -1 })), 'Post must have compound {author: 1, _id: -1} index');

  // Total custom indexes across entire application is exactly 4
  const totalCustomIndexes = (userIndexes.length - 1) + (noteIndexes.length - 1) + (postIndexes.length - 1);
  assert.equal(totalCustomIndexes, 4, 'Total custom index budget must be exactly 4');
});
