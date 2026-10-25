import { Router } from 'express';
import {
  listNotes,
  createNote,
  getNoteById,
  updateNote,
  deleteNote
} from '../controllers/notes.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createNoteSchema,
  updateNoteSchema,
  noteIdParamSchema
} from '../schemas/notes.schema.js';

export const notesRouter = Router();

notesRouter.use(authenticate);

notesRouter.get('/', listNotes);
notesRouter.post('/', validate({ body: createNoteSchema }), createNote);
notesRouter.get('/:id', validate({ params: noteIdParamSchema }), getNoteById);
notesRouter.patch('/:id', validate({ params: noteIdParamSchema, body: updateNoteSchema }), updateNote);
notesRouter.delete('/:id', validate({ params: noteIdParamSchema }), deleteNote);
