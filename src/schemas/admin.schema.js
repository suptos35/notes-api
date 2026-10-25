import { z } from 'zod';
import mongoose from 'mongoose';

export const adminCreateUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80, 'Name must not exceed 80 characters'),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(72),
    role: z.enum(['user', 'admin']).default('user'),
    interests: z.array(z.string()).max(10).optional().default([])
  })
  .strict();

export const adminUpdateUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80).optional(),
    role: z.enum(['user', 'admin']).optional(),
    interests: z.array(z.string()).max(10).optional(),
    password: z.string().min(8).max(72).optional()
  })
  .strict();

export const adminNotesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z
    .string()
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid cursor format'
    })
    .optional(),
  owner: z
    .string()
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid owner ID format'
    })
    .optional()
});
