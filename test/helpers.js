import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Note } from '../src/models/Note.js';
import { Post } from '../src/models/Post.js';

let mongod;

export async function setupTestDB() {
  mongod = await MongoMemoryServer.create({
    binary: {
      version: '7.0.14'
    }
  });
  const uri = mongod.getUri();
  await mongoose.connect(uri, { autoIndex: true });
  await Promise.all([User, Note, Post].map((m) => m.syncIndexes()));
}

export async function teardownTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongod) {
    await mongod.stop();
  }
}

export async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export { app, User, Note, Post };
