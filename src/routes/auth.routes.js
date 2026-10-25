import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const authRouter = Router();

// Rate limiter for auth endpoints (brute force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (req, res, next) => {
    next(ApiError.tooManyRequests('Too many authentication attempts, please try again later'));
  }
});

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), register);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), login);
authRouter.post('/logout', logout);
