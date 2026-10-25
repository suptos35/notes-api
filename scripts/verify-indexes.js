import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Note } from '../src/models/Note.js';
import { Post } from '../src/models/Post.js';

async function verifyIndexes() {
  console.log('Connecting to database...');
  await connectDB(env.MONGODB_URI);
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

  const sampleQueries = [
    {
      name: '1. Login by email',
      model: User,
      fn: () => User.collection.find({ email: 'test@example.com' }).explain('executionStats')
    },
    {
      name: '2. Get user by id',
      model: User,
      fn: () => User.collection.find({ _id: dummyId }).explain('executionStats')
    },
    {
      name: '3. Admin list users (keyset pagination)',
      model: User,
      fn: () => User.collection.find().sort({ _id: -1 }).limit(10).explain('executionStats')
    },
    {
      name: '4. User lists own notes',
      model: Note,
      fn: () => Note.collection.find({ owner: dummyId }).sort({ _id: -1 }).limit(10).explain('executionStats')
    },
    {
      name: '5. Admin lists all notes',
      model: Note,
      fn: () => Note.collection.find().sort({ _id: -1 }).limit(10).explain('executionStats')
    },
    {
      name: '6. Admin filters notes by owner',
      model: Note,
      fn: () => Note.collection.find({ owner: dummyId }).sort({ _id: -1 }).limit(10).explain('executionStats')
    },
    {
      name: '7. Public feed of all posts',
      model: Post,
      fn: () => Post.collection.find().sort({ _id: -1 }).limit(10).explain('executionStats')
    }
  ];

  for (const q of sampleQueries) {
    try {
      const explain = await q.fn();
      const stats = explain.executionStats || {};
      const winningStage = explain.queryPlanner?.winningPlan?.inputStage?.stage || explain.queryPlanner?.winningPlan?.stage;
      const indexName = explain.queryPlanner?.winningPlan?.inputStage?.indexName || explain.queryPlanner?.winningPlan?.indexName;
      console.log(`\nQuery: ${q.name}`);
      console.log(` - Stage: ${winningStage || 'N/A'}`);
      console.log(` - Index: ${indexName || 'N/A'}`);
      console.log(` - totalDocsExamined: ${stats.totalDocsExamined ?? 0}`);
      console.log(` - nReturned: ${stats.nReturned ?? 0}`);
    } catch (err) {
      console.log(`Query: ${q.name} - Explain error: ${err.message}`);
    }
  }

  await mongoose.connection.close();
  console.log('\nIndex verification completed.');
}

verifyIndexes().catch((err) => {
  console.error('Verify indexes failed:', err);
  process.exit(1);
});
