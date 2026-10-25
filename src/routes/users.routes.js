import { Router } from 'express';
import { getMe, updateMe, getUserById } from '../controllers/users.controller.js';
import { getUserPosts } from '../controllers/posts.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateMeSchema, userIdParamSchema } from '../schemas/users.schema.js';
import { userPostsQuerySchema } from '../schemas/posts.schema.js';

export const usersRouter = Router();

// Own profile
usersRouter.get('/me', authenticate, getMe);
usersRouter.patch('/me', authenticate, validate({ body: updateMeSchema }), updateMe);

// Scenario 2: Public endpoint for user posts via single aggregation pipeline ($lookup)
usersRouter.get(
  '/:id/posts',
  validate({ params: userIdParamSchema, query: userPostsQuerySchema }),
  getUserPosts
);

// Public profile (authenticated user)
usersRouter.get('/:id', authenticate, validate({ params: userIdParamSchema }), getUserById);
