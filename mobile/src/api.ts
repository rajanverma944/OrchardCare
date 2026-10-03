import * as SecureStore from 'expo-secure-store';

const BASE_KEY = 'oc.serverBase';
const ACCESS_KEY = 'oc.access';
const REFRESH_KEY = 'oc.refresh';
const USER_KEY = 'oc.user';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
}

export const DEFAULT_BASE = 'http://192.168.1.7:5092';

export async function getServerBase(): Promise<string> {
  return (await SecureStore.getItemAsync(BASE_KEY)) ?? DEFAULT_BASE;
}

export async function setServerBase(base: string): Promise<void> {
  await SecureStore.setItemAsync(BASE_KEY, base.replace(/\/+$/, ''));
}

export async function getTokens(): Promise<{ access: string | null; refresh: string | null }> {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  return { access, refresh };
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, access),
    SecureStore.setItemAsync(REFRESH_KEY, refresh),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

export async function saveUser(user: StoredUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function loadUser(): Promise<StoredUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Low-level request with a single transparent token-refresh retry. */
export async function request(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<any> {
  const base = await getServerBase();
  const { access } = await getTokens();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.auth !== false && access ? { Authorization: `Bearer ${access}` } : {}),
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && init.auth !== false && access) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retry = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${refreshed}`,
          ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers ?? {}),
        },
      });
      return handle(retry);
    }
  }
  return handle(res);
}

async function handle(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (body as any)?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'request_failed', err.message ?? `Request failed (${res.status})`);
  }
  return body;
}

async function tryRefresh(): Promise<string | null> {
  const { refresh } = await getTokens();
  if (!refresh) return null;
  try {
    const base = await getServerBase();
    const res = await fetch(`${base}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { accessToken: string; refreshToken: string };
    await saveTokens(body.accessToken, body.refreshToken);
    return body.accessToken;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<StoredUser> {
  const body = await request('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password }),
  });
  await saveTokens(body.accessToken, body.refreshToken);
  await saveUser(body.user);
  return body.user;
}

export async function register(name: string, email: string, password: string): Promise<StoredUser> {
  const body = await request('/api/auth/register', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ name, email, password }),
  });
  await saveTokens(body.accessToken, body.refreshToken);
  await saveUser(body.user);
  return body.user;
}

export async function logout(): Promise<void> {
  const { refresh } = await getTokens();
  if (refresh) {
    await request('/api/auth/logout', { method: 'POST', auth: false, body: JSON.stringify({ refreshToken: refresh }) }).catch(() => undefined);
  }
  await clearTokens();
}

export async function uploadPhoto(
  treeId: string,
  fileUri: string,
  meta: { direction: string; headingDeg?: number; clientPhotoId: string },
): Promise<any> {
  const form = new FormData();
  form.append('photo', {
    uri: fileUri,
    name: 'tree.jpg',
    type: 'image/jpeg',
  } as any);
  form.append('direction', meta.direction);
  form.append('clientPhotoId', meta.clientPhotoId);
  if (meta.headingDeg != null) form.append('headingDeg', String(meta.headingDeg));
  return request(`/api/photos/${treeId}/photos`, { method: 'POST', body: form });
}
