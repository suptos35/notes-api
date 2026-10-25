import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Note } from '../models/Note.js';
import { Post } from '../models/Post.js';
import { parsePaginationParams, paginateQuery } from '../utils/pagination.js';
import { normalizeInterests } from '../utils/normalizeInterests.js';
import { ApiError } from '../utils/ApiError.js';

export async function listUsers(req, res, next) {
  try {
    const { limit, cursor } = parsePaginationParams(req.query);
    // Uses default _id index
    const result = await paginateQuery(User, {}, { limit, cursor }, 'name email role interests createdAt');
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const { name, email, password, role, interests } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      throw ApiError.conflict('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: role || 'user',
      interests: normalizeInterests(interests || [])
    });

    res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        interests: user.interests,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.id).select('name email role interests createdAt');
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const targetId = req.params.id;
    const { name, role, interests, password } = req.body;

    // Self-protection: Admin cannot demote self
    if (targetId === req.user._id.toString() && role && role !== 'admin') {
      throw ApiError.badRequest('Admin cannot demote own account');
    }

    const update = {};
    if (name !== undefined) update.name = name;
    if (role !== undefined) update.role = role;
    if (interests !== undefined) update.interests = normalizeInterests(interests);
    if (password !== undefined) {
      update.passwordHash = await bcrypt.hash(password, 12);
    }

    const updatedUser = await User.findByIdAndUpdate(
      targetId,
      { $set: update },
      { new: true, runValidators: true }
    ).select('name email role interests createdAt');

    if (!updatedUser) {
      throw ApiError.notFound('User not found');
    }

    res.status(200).json({ user: updatedUser });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const targetId = req.params.id;

    // Self-protection: Admin cannot delete self
    if (targetId === req.user._id.toString()) {
      throw ApiError.badRequest('Admin cannot delete own account');
    }

    const user = await User.findById(targetId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Cascade delete children first, then user.
    // Both deleteMany calls use compound indexes {owner: 1, _id: -1} and {author: 1, _id: -1}.
    await Note.deleteMany({ owner: targetId });
    await Post.deleteMany({ author: targetId });
    await User.deleteOne({ _id: targetId });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function listAllNotes(req, res, next) {
  try {
    const { limit, cursor } = parsePaginationParams(req.query);

    // If owner filter is supplied, uses { owner: 1, _id: -1 }; otherwise uses default _id index
    const filter = req.query.owner
      ? { owner: new mongoose.Types.ObjectId(req.query.owner) }
      : {};

    const page = await paginateQuery(Note, filter, { limit, cursor });

    // Populate owners in a single batch query (avoids N+1 and uses _id index)
    const ownerIds = [...new Set(page.items.map((n) => n.owner.toString()))];
    const owners = await User.find({ _id: { $in: ownerIds } }, 'name').lean();
    const ownerMap = new Map(owners.map((o) => [o._id.toString(), { _id: o._id, name: o.name }]));

    const items = page.items.map((note) => ({
      ...note,
      owner: ownerMap.get(note.owner.toString()) || { _id: note.owner, name: 'Unknown' }
    }));

    res.status(200).json({
      items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore
    });
  } catch (err) {
    next(err);
  }
}
