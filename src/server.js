import mongoose from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Note } from './models/Note.js';
import { Post } from './models/Post.js';

let server;

async function startServer() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB(env.MONGODB_URI);
    console.log('MongoDB connected successfully.');

    // Ensure database indexes match declared schema indexes exactly
    console.log('Syncing database indexes...');
    await Promise.all([User, Note, Post].map((m) => m.syncIndexes()));
    console.log('Indexes synced successfully.');

    server = app.listen(env.PORT, () => {
      console.log(`Server listening on port ${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await mongoose.connection.close(false);
        console.log('MongoDB connection closed.');
        process.exit(0);
      } catch (err) {
        console.error('Error during MongoDB disconnect:', err);
        process.exit(1);
      }
    });

    // Force exit after 10s if connections don't close
    setTimeout(() => {
      console.error('Graceful shutdown timeout exceeded. Forcing exit.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
