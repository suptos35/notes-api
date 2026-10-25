import { z } from 'zod';

export const interestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  interest: z.string().trim().optional()
});
