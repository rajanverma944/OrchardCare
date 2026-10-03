import * as SQLite from 'expo-sqlite';

/**
 * Offline-first cache. All reads render from SQLite instantly; network calls
 * refresh the cache. Mutations are queued and flushed by the sync engine.
 */

export const db = SQLite.openDatabaseSync('orchardcare.db');

export interface CachedOrchard {
  id: string;
  name: string;
  village: string | null;
  latitude: number | null;
  longitude: number | null;
  elevationM: number | null;
  treeCount: number;
  avgHealthScore: number | null;
}

export interface CachedTree {
  id: string;
  orchardId: string;
  code: string;
  variety: string | null;
  healthGrade: string | null;
  healthScore: number | null;
  leafStrengthScore: number | null;
  diseaseCode: string | null;
  photoCount: number;
  lastAssessedAt: string | null;
}

export async function initDb(): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS orchards (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, village TEXT,
      elevation_m REAL, tree_count INTEGER DEFAULT 0, avg_health REAL
    );
    CREATE TABLE IF NOT EXISTS trees (
      id TEXT PRIMARY KEY, orchard_id TEXT NOT NULL, code TEXT NOT NULL,
      variety TEXT, health_grade TEXT, health_score INTEGER,
      leaf_strength INTEGER, disease_code TEXT, photo_count INTEGER DEFAULT 0,
      last_assessed TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_trees_orchard ON trees(orchard_id);
    CREATE TABLE IF NOT EXISTS sync_queue (
      client_id TEXT PRIMARY KEY, op TEXT NOT NULL, payload TEXT NOT NULL,
      queued_at TEXT NOT NULL, attempts INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS photo_queue (
      client_id TEXT PRIMARY KEY, tree_id TEXT NOT NULL, uri TEXT NOT NULL,
      direction TEXT NOT NULL, heading_deg REAL, queued_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  // Columns added after the first release: existing installs ALTER calmly.
  try { await db.execAsync('ALTER TABLE orchards ADD COLUMN latitude REAL'); } catch { /* exists */ }
  try { await db.execAsync('ALTER TABLE orchards ADD COLUMN longitude REAL'); } catch { /* exists */ }
}

export async function kvGet(key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export async function cacheOrchards(items: CachedOrchard[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM orchards');
    for (const o of items) {
      await db.runAsync(
        'INSERT OR REPLACE INTO orchards (id, name, village, latitude, longitude, elevation_m, tree_count, avg_health) VALUES (?,?,?,?,?,?,?,?)',
        [o.id, o.name, o.village, o.latitude, o.longitude, o.elevationM, o.treeCount, o.avgHealthScore],
      );
    }
  });
}

export async function cachedOrchards(): Promise<CachedOrchard[]> {
  return db.getAllAsync<CachedOrchard>(
    `SELECT id, name, village, latitude, longitude, elevation_m AS "elevationM", tree_count AS "treeCount", avg_health AS "avgHealthScore" FROM orchards ORDER BY name`,
  );
}

export async function cacheTrees(orchardId: string, items: CachedTree[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM trees WHERE orchard_id = ?', [orchardId]);
    for (const t of items) {
      await db.runAsync(
        `INSERT OR REPLACE INTO trees (id, orchard_id, code, variety, health_grade, health_score,
                                       leaf_strength, disease_code, photo_count, last_assessed)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [t.id, orchardId, t.code, t.variety, t.healthGrade, t.healthScore, t.leafStrengthScore, t.diseaseCode, t.photoCount, t.lastAssessedAt],
      );
    }
  });
}

export async function cachedTrees(orchardId: string): Promise<CachedTree[]> {
  return db.getAllAsync<CachedTree>(
    `SELECT id, orchard_id AS "orchardId", code, variety, health_grade AS "healthGrade",
            health_score AS "healthScore", leaf_strength AS "leafStrengthScore",
            disease_code AS "diseaseCode", photo_count AS "photoCount", last_assessed AS "lastAssessedAt"
     FROM trees WHERE orchard_id = ? ORDER BY code`,
    [orchardId],
  );
}

export interface QueueItem {
  clientId: string;
  op: string;
  payload: Record<string, unknown>;
}

export async function enqueue(item: QueueItem): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO sync_queue (client_id, op, payload, queued_at) VALUES (?,?,?,?)',
    [item.clientId, item.op, JSON.stringify(item.payload), new Date().toISOString()],
  );
}

export async function queuedChanges(): Promise<QueueItem[]> {
  const rows = await db.getAllAsync<{ client_id: string; op: string; payload: string }>(
    'SELECT client_id, op, payload FROM sync_queue ORDER BY queued_at LIMIT 100',
  );
  return rows.map((r) => ({ clientId: r.client_id, op: r.op, payload: JSON.parse(r.payload) }));
}

export async function dequeue(clientIds: string[]): Promise<void> {
  for (const id of clientIds) {
    await db.runAsync('DELETE FROM sync_queue WHERE client_id = ?', [id]);
  }
}

export async function enqueuePhoto(treeId: string, uri: string, direction: string, headingDeg: number | null): Promise<string> {
  const clientId = `${new Date().toISOString()}-${Math.random()}`;
  await db.runAsync(
    'INSERT INTO photo_queue (client_id, tree_id, uri, direction, heading_deg, queued_at) VALUES (?,?,?,?,?,?)',
    [clientId, treeId, uri, direction, headingDeg, new Date().toISOString()],
  );
  return clientId;
}

export async function queuedPhotos(): Promise<{ clientId: string; treeId: string; uri: string; direction: string; headingDeg: number | null }[]> {
  const rows = await db.getAllAsync<{ client_id: string; tree_id: string; uri: string; direction: string; heading_deg: number | null }>(
    'SELECT client_id, tree_id, uri, direction, heading_deg FROM photo_queue ORDER BY queued_at LIMIT 50',
  );
  return rows.map((r) => ({ clientId: r.client_id, treeId: r.tree_id, uri: r.uri, direction: r.direction, headingDeg: r.heading_deg }));
}

export async function dequeuePhoto(clientId: string): Promise<void> {
  await db.runAsync('DELETE FROM photo_queue WHERE client_id = ?', [clientId]);
}

export async function pendingCounts(): Promise<{ changes: number; photos: number }> {
  const c = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM sync_queue');
  const p = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM photo_queue');
  return { changes: c?.n ?? 0, photos: p?.n ?? 0 };
}
