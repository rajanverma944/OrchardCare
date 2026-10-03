import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/** Minimal .env loader (avoids an extra dependency). */
function loadDotEnv(): void {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_TEST: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5092),
  PHOTOS_DIR: z.string().min(1).default('data/photos'),
  PUBLIC_BASE_URL: z.string().url().default('http://127.0.0.1:5092'),
  ACCESS_TOKEN_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(90),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${issues}`);
}

const env = parsed.data;

export const config = {
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  databaseUrlTest: env.DATABASE_URL_TEST ?? env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET,
  photosDir: path.isAbsolute(env.PHOTOS_DIR)
    ? env.PHOTOS_DIR
    : path.join(__dirname, '..', env.PHOTOS_DIR),
  publicBaseUrl: env.PUBLIC_BASE_URL.replace(/\/+$/, ''),
  accessTokenHours: env.ACCESS_TOKEN_HOURS,
  refreshTokenDays: env.REFRESH_TOKEN_DAYS,
  maxPhotoBytes: 12 * 1024 * 1024,
} as const;
