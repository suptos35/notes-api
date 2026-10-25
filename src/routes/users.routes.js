import { Router } from 'express';
import { getMe, updateMe, getUserById } from '../controllers/users.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateMeSchema, userIdParamSchema } from '../schemas/users.schema.js';

export const usersRouter = Router();

usersRouter.get('/me', authenticate, getMe);
usersRouter.patch('/me', authenticate, validate({ body: updateMeSchema }), updateMe);
usersRouter.get('/:id', authenticate, validate({ params: userIdParamSchema }), getUserById);
