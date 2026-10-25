import { z } from 'zod';
import mongoose from 'mongoose';

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80, 'Name must not exceed 80 characters').optional(),
    interests: z.array(z.string()).max(10, 'Cannot exceed 10 interests').optional()
  })
  .strict();

export const userIdParamSchema = z.object({
  id: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid user ID format'
  })
});
