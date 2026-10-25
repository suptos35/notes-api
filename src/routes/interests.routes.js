import { Router } from 'express';
import { getGroupedByInterests } from '../controllers/interests.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { interestsQuerySchema } from '../schemas/interests.schema.js';

export const interestsRouter = Router();

// Scenario 1: Group users by interests
interestsRouter.get('/', authenticate, validate({ query: interestsQuerySchema }), getGroupedByInterests);
