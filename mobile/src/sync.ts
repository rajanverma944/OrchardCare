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

function clientId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
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

export { clientId };
