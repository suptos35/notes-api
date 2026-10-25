import { AUTH_COOKIE_NAME, verifyToken } from '../utils/authCookie.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

export async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
      throw ApiError.unauthorized('Authentication required');
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      throw ApiError.unauthorized('Invalid or expired authentication token');
    }

    // Always fetch user fresh from the database to ensure role changes
    // or account deletions take effect immediately (uses default _id index)
    const user = await User.findById(decoded.sub).select('name email role');
    if (!user) {
      throw ApiError.unauthorized('User account no longer exists');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
