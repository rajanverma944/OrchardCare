import { request } from './api';
import {
  dequeue,
  dequeuePhoto,
  queuedChanges,
  queuedPhotos,
  type QueueItem,
} from './db';
import { uploadPhoto } from './api';

export interface SyncReport {
  synced: number;
  failed: number;
  photosSynced: number;
  photosFailed: number;
}

/**
 * RFC4122 v4-shaped id. Used purely as an idempotency key (the server
 * requires a UUID); crypto strength is irrelevant, and Hermes does not
 * provide crypto.randomUUID, so we build one ourselves.
 */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function clientId(): string {
  return globalThis.crypto?.randomUUID?.() ?? uuidv4();
}

/** Flush the offline queue; returns a report for the UI. */
export async function flushQueue(): Promise<SyncReport> {
  const report: SyncReport = { synced: 0, failed: 0, photosSynced: 0, photosFailed: 0 };

  const photos = await queuedPhotos();
  for (const p of photos) {
    try {
      await uploadPhoto(p.treeId, p.uri, {
        direction: p.direction,
        headingDeg: p.headingDeg ?? undefined,
        clientPhotoId: p.clientId,
      });
      await dequeuePhoto(p.clientId);
      report.photosSynced++;
    } catch {
      report.photosFailed++;
      break; // network likely down; retry next time
    }
  }

  let batch: QueueItem[] = await queuedChanges();
  while (batch.length > 0) {
    try {
      const res = await request('/api/sync', {
        method: 'POST',
        body: JSON.stringify({ changes: batch }),
      });
      const results = res.results as { clientId: string; ok: boolean }[];
      const okIds = results.filter((r) => r.ok).map((r) => r.clientId);
      report.synced += okIds.length;
      report.failed += results.length - okIds.length;
      await dequeue(okIds);
      batch = await queuedChanges();
      if (okIds.length === 0) break; // nothing progressed; avoid loops
    } catch {
      report.failed += batch.length;
      break;
    }
  }
  return report;
}
