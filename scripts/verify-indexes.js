import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Note } from '../src/models/Note.js';
import { Post } from '../src/models/Post.js';

let mongodInstance = null;

async function connect() {
  try {
    console.log(`Attempting connection to ${env.MONGODB_URI}...`);
    // Short timeout to fail fast if no local server
    await mongoose.connect(env.MONGODB_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 2000
    });
    console.log('Connected to configured MongoDB.');
  } catch (err) {
    console.log(`Could not connect to ${env.MONGODB_URI} (${err.message}).`);
    console.log('Starting in-memory MongoDB 7.0 for verification...');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongodInstance = await MongoMemoryServer.create({
      binary: { version: '7.0.14' }
    });
    const memoryUri = mongodInstance.getUri();
    await mongoose.connect(memoryUri, { autoIndex: true });
    console.log('Connected to in-memory MongoDB 7.0.');
  }
}

async function verifyIndexes() {
  await connect();

  console.log('Syncing declared schema indexes...');
  await Promise.all([User, Note, Post].map((m) => m.syncIndexes()));

  console.log('\n================ DECLARED INDEXES ================');
  for (const model of [User, Note, Post]) {
    const indexes = await model.collection.indexes();
    console.log(`\nModel: ${model.modelName} (Collection: ${model.collection.name})`);
    for (const idx of indexes) {
      console.log(` - Name: ${idx.name}, Key: ${JSON.stringify(idx.key)}, Unique: ${Boolean(idx.unique)}`);
    }
  }

  console.log('\n================ QUERY EXPLAIN PLANS ================');
  const dummyId = new mongoose.Types.ObjectId();

  // Create minimal sample data to make query planner realistic
  const sampleUser = await User.create({
    name: 'Sample Query User',
    email: 'user1@example.com',
    passwordHash: 'dummy',
    role: 'user',
    interests: ['chess', 'coding']
  });

  await Note.create({
    owner: sampleUser._id,
    title: 'Sample Note',
    content: 'Content'
  });

  await Post.create({
    author: sampleUser._id,
    title: 'Sample Post',
    content: 'Post Content'
  });

  const testUserId = sampleUser._id;

  const sampleQueries = [
    {
      name: '1. Login by email (users {email:1})',
      fn: () => User.collection.find({ email: 'user1@example.com' }).explain('executionStats')
    },
    {
      name: '2. Get user by id (default _id)',
      fn: () => User.collection.find({ _id: testUserId }).explain('executionStats')
    },
    {
      name: '3. Admin list users (keyset cursor, default _id)',
      fn: () => User.collection.find().sort({ _id: -1 }).limit(10).explain('executionStats')
    },
    {
      name: '4. Get note by id with owner check (default _id)',
      fn: () => Note.collection.find({ _id: dummyId, owner: testUserId }).explain('executionStats')
    },
    {
      name: '5. User lists own notes (notes {owner:1,_id:-1})',
      fn: () => Note.collection.find({ owner: testUserId }).sort({ _id: -1 }).limit(10).explain('executionStats')
    },
    {
      name: '6. Admin lists all notes (default _id)',
      fn: () => Note.collection.find({}).sort({ _id: -1 }).limit(10).explain('executionStats')
    },
    {
      name: '7. Admin filters notes by owner (notes {owner:1,_id:-1})',
      fn: () => Note.collection.find({ owner: testUserId }).sort({ _id: -1 }).limit(10).explain('executionStats')
    },
    {
      name: '8. Public feed of all posts (default _id)',
      fn: () => Post.collection.find({}).sort({ _id: -1 }).limit(10).explain('executionStats')
    },
    {
      name: '9. Scenario 1: Group by interests (users {interests:1})',
      fn: () =>
        User.aggregate([
          { $match: { interests: { $gt: '' } } },
          { $unwind: '$interests' },
          {
            $group: {
              _id: '$interests',
              count: { $sum: 1 },
              users: { $push: { _id: '$_id', name: '$name' } }
            }
          },
          { $sort: { _id: 1 } },
          {
            $facet: {
              groups: [{ $skip: 0 }, { $limit: 10 }],
              total: [{ $count: 'n' }]
            }
          }
        ]).explain('executionStats')
    },
    {
      name: '10. Scenario 2: User posts via $lookup (posts {author:1,_id:-1})',
      fn: () =>
        User.aggregate([
          { $match: { _id: testUserId } },
          { $project: { name: 1 } },
          {
            $lookup: {
              from: Post.collection.name,
              localField: '_id',
              foreignField: 'author',
              pipeline: [{ $sort: { _id: -1 } }, { $limit: 11 }],
              as: 'posts'
            }
          }
        ]).explain('executionStats')
    }
  ];

  for (const q of sampleQueries) {
    try {
      const explain = await q.fn();
      console.log(`\n--------------------------------------------------`);
      console.log(`Query: ${q.name}`);

      if (explain.stages) {
        // Aggregation explain
        const firstStage = explain.stages[0];
        console.log(` - Type: Aggregation Pipeline`);
        if (firstStage?.$cursor) {
          const cursorPlan = firstStage.$cursor.queryPlanner?.winningPlan;
          const stageName = cursorPlan?.inputStage?.stage || cursorPlan?.stage;
          const indexName = cursorPlan?.inputStage?.indexName || cursorPlan?.indexName;
          console.log(` - Leading Cursor Stage: ${stageName}`);
          console.log(` - Index Used: ${indexName || 'N/A'}`);
          console.log(` - totalDocsExamined: ${firstStage.$cursor.executionStats?.totalDocsExamined ?? 0}`);
          console.log(` - nReturned: ${firstStage.$cursor.executionStats?.nReturned ?? 0}`);
        }
      } else {
        // Find explain
        const stats = explain.executionStats || {};
        const winningPlan = explain.queryPlanner?.winningPlan;
        const stageName = winningPlan?.inputStage?.stage || winningPlan?.stage;
        const indexName = winningPlan?.inputStage?.indexName || winningPlan?.indexName;
        console.log(` - Winning Stage: ${stageName}`);
        console.log(` - Index Name: ${indexName || 'N/A'}`);
        console.log(` - totalDocsExamined: ${stats.totalDocsExamined ?? 0}`);
        console.log(` - nReturned: ${stats.nReturned ?? 0}`);
      }
    } catch (err) {
      console.log(`Query: ${q.name} - Explain error: ${err.message}`);
    }
  }

  await mongoose.connection.close();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
  console.log('\n================ VERIFICATION COMPLETE ================');
}

verifyIndexes().catch((err) => {
  console.error('Verify indexes failed:', err);
  process.exit(1);
});
