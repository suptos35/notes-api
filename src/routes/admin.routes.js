import { Router } from 'express';
import {
  listUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  listAllNotes
} from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { userIdParamSchema } from '../schemas/users.schema.js';
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  adminNotesQuerySchema
} from '../schemas/admin.schema.js';

export const adminRouter = Router();

// Strict RBAC: All /admin routes require authenticated admin
adminRouter.use(authenticate, requireRole('admin'));

adminRouter.get('/users', listUsers);
adminRouter.post('/users', validate({ body: adminCreateUserSchema }), createUser);
adminRouter.get('/users/:id', validate({ params: userIdParamSchema }), getUserById);
adminRouter.patch('/users/:id', validate({ params: userIdParamSchema, body: adminUpdateUserSchema }), updateUser);
adminRouter.delete('/users/:id', validate({ params: userIdParamSchema }), deleteUser);
adminRouter.get('/notes', validate({ query: adminNotesQuerySchema }), listAllNotes);
