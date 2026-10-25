import { Router } from 'express';
import { createPost, listFeed } from '../controllers/posts.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createPostSchema } from '../schemas/posts.schema.js';

export const postsRouter = Router();

// Public feed
postsRouter.get('/', listFeed);

// Create post requires authenticated user
postsRouter.post('/', authenticate, validate({ body: createPostSchema }), createPost);
