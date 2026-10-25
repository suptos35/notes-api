import { z } from 'zod';
import mongoose from 'mongoose';

export const createPostSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120, 'Title must not exceed 120 characters'),
    content: z.string().trim().min(1, 'Content is required').max(5000, 'Content must not exceed 5000 characters')
  })
  .strict();

export const userPostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z
    .string()
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid cursor format'
    })
    .optional()
});
