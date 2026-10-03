import bcrypt from 'bcryptjs';
import { query, type DbClient } from '../db';
import { ApiError } from '../middleware/error';
import {
  hashToken,
  newRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from './tokenService';
import type { AuthUser } from '../types';

const BCRYPT_ROUNDS = 12;

/**
 * Compare against this hash when the email is unknown so that login takes a
 * similar amount of time either way (mitigates user-enumeration via timing).
 */
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', BCRYPT_ROUNDS);

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

async function issueTokens(user: AuthUser, client?: DbClient): Promise<AuthResult> {
  const refreshToken = newRefreshToken();
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, hashToken(refreshToken), refreshTokenExpiry()],
    client,
  );
  return { user, accessToken: signAccessToken(user), refreshToken };
}

export async function register(name: string, email: string, password: string): Promise<AuthResult> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const rows = await query<UserRow & { id: string }>(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, passwordHash],
    );
    const row = rows[0];
    return issueTokens({ id: row.id, name: row.name, email: row.email });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === '23505') {
      throw new ApiError(409, 'email_taken', 'An account with this email already exists');
    }
    throw err;
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const rows = await query<UserRow>(
    'SELECT id, name, email, password_hash FROM users WHERE email = $1',
    [email],
  );
  const row = rows[0];
  const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    throw new ApiError(401, 'invalid_credentials', 'Invalid email or password');
  }
  return issueTokens({ id: row.id, name: row.name, email: row.email });
}

/**
 * Refresh with rotation: a valid token is revoked and replaced. Reuse of an
 * already-revoked token revokes every session for that user (theft detection).
 */
export async function refresh(refreshToken: string): Promise<AuthResult> {
  const h = hashToken(refreshToken);
  const rows = await query<
    UserRow & { rt_id: string; rt_user: string; revoked_at: Date | null; expires_at: Date }
  >(
    `SELECT rt.id AS rt_id, rt.user_id AS rt_user, rt.revoked_at, rt.expires_at,
            u.id, u.name, u.email, u.password_hash
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [h],
  );
  const row = rows[0];
  if (!row) {
    throw new ApiError(401, 'invalid_refresh', 'Please sign in again');
  }
  if (row.revoked_at) {
    // Token reuse - assume compromise, kill all sessions.
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [row.rt_user]);
    throw new ApiError(401, 'invalid_refresh', 'Session was refreshed elsewhere - please sign in again');
  }
  if (row.expires_at.getTime() <= Date.now()) {
    throw new ApiError(401, 'invalid_refresh', 'Session expired - please sign in again');
  }
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.rt_id]);
  return issueTokens({ id: row.id, name: row.name, email: row.email });
}

export async function logout(refreshToken: string): Promise<void> {
  await query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
    [hashToken(refreshToken)],
  );
}

/** Housekeeping: drop expired/revoked tokens older than 7 days. */
export async function pruneRefreshTokens(): Promise<void> {
  await query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < now() - interval '7 days'
        OR revoked_at < now() - interval '7 days'`,
  );
}
