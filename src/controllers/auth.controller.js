import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { signToken, setAuthCookie, clearAuthCookie } from '../utils/authCookie.js';
import { ApiError } from '../utils/ApiError.js';

// Precomputed bcrypt cost-12 dummy hash for constant-time comparison on unknown email
const DUMMY_HASH = '$2a$12$e80yq7K3t4s1qg2mP.6kbeG3V8VwNn5k6Q2B7yZ5Xq0M3tQyEwJ2O';

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw ApiError.conflict('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'user', // Strictly user; cannot register as admin
      interests: []
    });

    const token = signToken(user);
    setAuthCookie(res, token);

    res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        interests: user.interests
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Use email index (users {email: 1})
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
      // Prevent timing attacks by still executing bcrypt compare
      await bcrypt.compare(password, DUMMY_HASH);
      throw ApiError.unauthorized('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        interests: user.interests
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res) {
  clearAuthCookie(res);
  res.status(204).end();
}
