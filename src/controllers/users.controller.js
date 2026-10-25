import { User } from '../models/User.js';
import { normalizeInterests } from '../utils/normalizeInterests.js';
import { ApiError } from '../utils/ApiError.js';

export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('name email role interests createdAt');
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req, res, next) {
  try {
    const { name, interests } = req.body;
    const update = {};

    if (name !== undefined) {
      update.name = name;
    }
    if (interests !== undefined) {
      update.interests = normalizeInterests(interests);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true, runValidators: true }
    ).select('name email role interests createdAt');

    res.status(200).json({ user: updatedUser });
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.id).select('name interests');
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}
