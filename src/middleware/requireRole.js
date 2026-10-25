import { ApiError } from '../utils/ApiError.js';

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (req.user.role !== role) {
      return next(ApiError.forbidden('Access denied: insufficient permissions'));
    }
    next();
  };
}
