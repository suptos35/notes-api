import { z } from 'zod';
import mongoose from 'mongoose';

export const createNoteSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120, 'Title must not exceed 120 characters'),
    content: z.string().max(10000, 'Content must not exceed 10000 characters').default('')
  })
  .strict();

export const updateNoteSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120, 'Title must not exceed 120 characters').optional(),
    content: z.string().max(10000, 'Content must not exceed 10000 characters').optional()
  })
  .strict();

export const noteIdParamSchema = z.object({
  id: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid note ID format'
  })
});
