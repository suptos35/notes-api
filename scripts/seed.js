import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Note } from '../src/models/Note.js';
import { Post } from '../src/models/Post.js';
import { normalizeInterests } from '../src/utils/normalizeInterests.js';

const INTEREST_POOL = [
  'chess',
  'reading',
  'cycling',
  'cooking',
  'gaming',
  'hiking',
  'music',
  'photography',
  'coding',
  'painting',
  'running',
  'travel'
];

async function seed() {
  console.log('Connecting to MongoDB for seeding...');
  await connectDB(env.MONGODB_URI);
  await Promise.all([User, Note, Post].map((m) => m.syncIndexes()));

  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Note.deleteMany({}),
    Post.deleteMany({})
  ]);

  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  // 1. Create Admin
  const adminEmail = env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = env.SEED_ADMIN_PASSWORD || defaultPassword;
  const adminHash = adminPassword === defaultPassword ? passwordHash : await bcrypt.hash(adminPassword, 12);

  const admin = await User.create({
    name: 'Primary Admin',
    email: adminEmail.toLowerCase().trim(),
    passwordHash: adminHash,
    role: 'admin',
    interests: normalizeInterests(['coding', 'chess', 'reading'])
  });
  console.log(`Created admin: ${admin.email} (Password: ${adminPassword})`);

  // 2. Create 40 Sample Users
  const userDocs = [];
  for (let i = 1; i <= 40; i++) {
    // Pick 1 to 4 random interests
    const numInterests = 1 + (i % 4);
    const shuffled = [...INTEREST_POOL].sort(() => 0.5 - Math.random());
    const interests = shuffled.slice(0, numInterests);

    userDocs.push({
      name: `User ${i.toString().padStart(2, '0')}`,
      email: `user${i}@example.com`,
      passwordHash,
      role: 'user',
      interests: normalizeInterests(interests)
    });
  }

  const createdUsers = await User.insertMany(userDocs);
  console.log(`Created ${createdUsers.length} sample users.`);

  // 3. Create notes for users (5 to 15 notes per user)
  const allUsers = [admin, ...createdUsers];
  const noteDocs = [];
  const postDocs = [];

  for (const user of allUsers) {
    const numNotes = 5 + (parseInt(user._id.toString().slice(-2), 16) % 11); // 5 to 15
    for (let j = 1; j <= numNotes; j++) {
      noteDocs.push({
        owner: user._id,
        title: `Note #${j} for ${user.name}`,
        content: `Personal note content ${j} created by ${user.name}. Contains confidential project details and reminders.`
      });
    }

    // 2 to 8 posts for some users (e.g. 25 users)
    if (user.role === 'admin' || parseInt(user._id.toString().slice(-1), 16) % 2 === 0) {
      const numPosts = 2 + (parseInt(user._id.toString().slice(-2), 16) % 7); // 2 to 8
      for (let k = 1; k <= numPosts; k++) {
        postDocs.push({
          author: user._id,
          title: `Public Thought #${k} from ${user.name}`,
          content: `Publicly visible post #${k}. Thoughts on software engineering, clean architecture, and index optimization.`
        });
      }
    }
  }

  // Insert in batches
  await Note.insertMany(noteDocs);
  console.log(`Created ${noteDocs.length} notes.`);

  await Post.insertMany(postDocs);
  console.log(`Created ${postDocs.length} public posts.`);

  console.log('\n================ SEED SUMMARY ================');
  console.log(`Admin Email: ${adminEmail}`);
  console.log(`Admin Password: ${adminPassword}`);
  console.log(`Sample User: user1@example.com`);
  console.log(`Sample Password: ${defaultPassword}`);
  console.log('Seeding completed successfully.');

  await mongoose.connection.close();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
