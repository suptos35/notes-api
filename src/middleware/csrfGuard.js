import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export function csrfGuard(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.headers.origin;

  // If Origin header is present, verify it matches allowed CORS origins
  if (origin && !env.CORS_ORIGINS.includes(origin)) {
    return next(new ApiError(403, 'CSRF_BLOCKED', 'Cross-site request blocked: untrusted origin'));
  }

  // If request sends a body, enforce application/json
  const hasBody = req.headers['content-length'] && req.headers['content-length'] !== '0';
  if (hasBody) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return next(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json'));
    }
  }

  next();
}
