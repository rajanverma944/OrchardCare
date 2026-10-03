import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { AuthUser } from '../types';

export interface AccessTokenClaims {
  sub: string;
  name: string;
  email: string;
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    { name: user.name, email: user.email },
    config.jwtSecret,
    {
      subject: user.id,
      expiresIn: `${config.accessTokenHours}h`,
      issuer: 'orchardcare',
      audience: 'orchardcare-app',
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, config.jwtSecret, {
    issuer: 'orchardcare',
    audience: 'orchardcare-app',
  }) as AccessTokenClaims;
}

/** Opaque refresh token: 48 random bytes, base64url. Only its SHA-256 is stored. */
export function newRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000);
}
