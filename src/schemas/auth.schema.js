import { z } from 'zod';

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80, 'Name must not exceed 80 characters'),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must not exceed 72 characters')
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required')
  })
  .strict();
