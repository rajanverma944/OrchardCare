import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../services/tokenService';
import type { AuthUser } from '../types';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'unauthorized', message: 'Sign in required' } });
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
    req.user = { id: payload.sub, name: payload.name, email: payload.email } satisfies AuthUser;
    next();
  } catch {
    res.status(401).json({ error: { code: 'unauthorized', message: 'Session expired - please sign in again' } });
  }
}
