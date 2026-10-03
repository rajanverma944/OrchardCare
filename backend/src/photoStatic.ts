import express, { type RequestHandler } from 'express';
import { config } from './config';

/** Static photo serving with unguessable GUID filenames (immutable cache). */
export function photoStatic(): RequestHandler {
  return express.static(config.photosDir, {
    maxAge: '30d',
    immutable: true,
    index: false,
    fallthrough: false,
  }) as unknown as RequestHandler;
}
