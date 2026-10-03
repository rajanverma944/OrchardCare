import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler =
  (fn: AsyncHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'not_found', message: 'Resource not found' } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_failed',
        message: 'Invalid request data',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  const anyErr = err as { code?: string; message?: string; constraint?: string };
  // PostgreSQL errors
  if (anyErr?.code === '23505' || (anyErr?.constraint ?? '').includes('unique')) {
    res.status(409).json({ error: { code: 'conflict', message: 'A record with these details already exists' } });
    return;
  }
  if (anyErr?.code === '23503' || (anyErr?.constraint ?? '').includes('fkey')) {
    res.status(409).json({ error: { code: 'conflict', message: 'Related record does not exist or is in use' } });
    return;
  }
  // Multer file-too-large
  if (anyErr?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: { code: 'file_too_large', message: 'Photo exceeds the 12 MB limit' } });
    return;
  }
  console.error(`[error] ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: { code: 'internal', message: 'Something went wrong on the server' } });
}
