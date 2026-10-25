import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const AUTH_COOKIE_NAME = 'access_token';

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 1000 // 1 hour
  };
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role
    },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '1h'
    }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256']
  });
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

export function clearAuthCookie(res) {
  const { maxAge, ...clearOptions } = getAuthCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, clearOptions);
}
