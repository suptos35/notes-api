import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { noStore } from './middleware/noStore.js';
import { csrfGuard } from './middleware/csrfGuard.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { notesRouter } from './routes/notes.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { ApiError } from './utils/ApiError.js';

export const app = express();

// Trust reverse proxy (e.g. Render, Vercel) for rate limiting & IP detection
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS configuration (allow credentials for httpOnly cookies)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, tests) or matching origins
      if (!origin || env.CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin']
  })
);

// Body parsing with size limit
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Request logging (skip in test environment)
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoint for Render warmup and uptime monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    db: mongoose.connection.readyState === 1
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    ok: true,
    db: mongoose.connection.readyState === 1
  });
});

// Apply no-store cache control and CSRF guard to all /api endpoints
app.use('/api', noStore, csrfGuard);

// Route modules
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/notes', notesRouter);
app.use('/api/admin', adminRouter);

// 404 Handler for undefined routes
app.use((req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
});

// Centralized error handler
app.use(errorHandler);
