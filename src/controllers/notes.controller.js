import { Note } from '../models/Note.js';
import { parsePaginationParams, paginateQuery } from '../utils/pagination.js';
import { ApiError } from '../utils/ApiError.js';

export async function listNotes(req, res, next) {
  try {
    const { limit, cursor } = parsePaginationParams(req.query);
    // Uses compound index { owner: 1, _id: -1 }
    const result = await paginateQuery(Note, { owner: req.user._id }, { limit, cursor });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createNote(req, res, next) {
  try {
    const { title, content } = req.body;
    const note = await Note.create({
      owner: req.user._id,
      title,
      content
    });
    res.status(201).json({ note });
  } catch (err) {
    next(err);
  }
}

export async function getNoteById(req, res, next) {
  try {
    // Admin can view any note; regular user can only view their own.
    // Querying with owner filter uses compound index { owner: 1, _id: -1 } or default _id index.
    const query = req.user.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, owner: req.user._id };

    const note = await Note.findOne(query);
    if (!note) {
      // Always return 404 to avoid revealing whether another user's note exists
      throw ApiError.notFound('Note not found');
    }

    res.status(200).json({ note });
  } catch (err) {
    next(err);
  }
}

export async function updateNote(req, res, next) {
  try {
    // Non-owners (even admins) cannot edit notes
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!note) {
      throw ApiError.notFound('Note not found');
    }

    res.status(200).json({ note });
  } catch (err) {
    next(err);
  }
}

export async function deleteNote(req, res, next) {
  try {
    // Non-owners (even admins) cannot delete notes via /notes/:id
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!note) {
      throw ApiError.notFound('Note not found');
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
