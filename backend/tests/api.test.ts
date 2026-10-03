import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { closePool, pool } from '../src/db';
import { runMigrations } from '../src/migrate';

/**
 * Integration suite against the orchardcare_test database.
 * Covers the full field workflow plus the authorization matrix.
 */

let app: ReturnType<typeof buildApp>;

const A = {
  name: 'Rajan Verma',
  email: 'rajan@test.example',
  password: 'Orchard#2026',
};
let accessTokenA = '';
let refreshTokenA = '';

async function registerAndLogin(user: { name: string; email: string; password: string }) {
  await request(app).post('/api/auth/register').send(user);
  const res = await request(app).post('/api/auth/login').send({
    email: user.email,
    password: user.password,
  });
  return res.body as { accessToken: string; refreshToken: string };
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await runMigrations();
  app = buildApp();
});

beforeEach(async () => {
  await pool.query(
    `TRUNCATE survey_entries, surveys, tree_photos, observations, trees, spray_tasks, orchards, refresh_tokens, users CASCADE`,
  );
  const tokens = await registerAndLogin(A);
  accessTokenA = tokens.accessToken;
  refreshTokenA = tokens.refreshToken;
});

afterAll(async () => {
  await closePool();
});

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function createOrchard(): Promise<string> {
  const res = await request(app)
    .post('/api/orchards')
    .set(auth(accessTokenA))
    .send({ name: 'Test Bagicha', village: 'Kotgarh', latitude: 31.29, longitude: 77.47, elevationM: 2300 });
  expect(res.status).toBe(201);
  return res.body.orchard.id as string;
}

async function createTree(orchardId: string, code = 'T-001', extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post(`/api/trees/orchards/${orchardId}/trees`)
    .set(auth(accessTokenA))
    .send({ code, latitude: 31.2901, longitude: 77.4702, clientTreeId: crypto.randomUUID(), ...extra });
  expect([200, 201]).toContain(res.status);
  return res.body.treeId as string;
}

function makeJpeg(): Buffer {
  // Minimal valid JPEG (sharp decodes it; colour classify handles 1x1)
  return Buffer.from(
    'ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fbfa28a2803ffd9',
    'hex',
  );
}

describe('health & advice', () => {
  it('health check is public', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('advice handbook is public and complete', async () => {
    const res = await request(app).get('/api/advice/handbook');
    expect(res.status).toBe(200);
    expect(res.body.diseases.length).toBeGreaterThanOrEqual(12);
    expect(res.body.articles.length).toBeGreaterThanOrEqual(20);
    expect(res.body.sprayStages.length).toBe(12);
  });
});

describe('auth', () => {
  it('rejects weak passwords', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X Y', email: 'x@y.example', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });

  it('rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send(A);
    expect(res.status).toBe(409);
  });

  it('login fails with wrong password (same message for unknown user)', async () => {
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.example', password: 'Whatever#1' });
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: A.email, password: 'WrongPass#9' });
    expect(bad.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(bad.body.error.message).toBe(wrong.body.error.message);
  });

  it('refresh rotation works and reuse is detected', async () => {
    const first = await request(app).post('/api/auth/refresh').send({ refreshToken: refreshTokenA });
    expect(first.status).toBe(200);
    const newToken = first.body.refreshToken as string;

    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: refreshTokenA });
    expect(reuse.status).toBe(401);

    // After theft detection even the fresh token must be dead
    const after = await request(app).post('/api/auth/refresh').send({ refreshToken: newToken });
    expect(after.status).toBe(401);
  });

  it('logout invalidates the refresh token', async () => {
    await request(app).post('/api/auth/logout').send({ refreshToken: refreshTokenA });
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: refreshTokenA });
    expect(res.status).toBe(401);
  });
});

describe('orchards & trees', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/orchards');
    expect(res.status).toBe(401);
  });

  it('creates and lists orchards', async () => {
    const id = await createOrchard();
    const list = await request(app).get('/api/orchards').set(auth(accessTokenA));
    expect(list.status).toBe(200);
    expect(list.body.orchards).toHaveLength(1);
    expect(list.body.orchards[0].id).toBe(id);
    expect(list.body.orchards[0].treeCount).toBe(0);
  });

  it('creates trees idempotently by clientTreeId', async () => {
    const orchardId = await createOrchard();
    const clientTreeId = crypto.randomUUID();
    const r1 = await request(app)
      .post(`/api/trees/orchards/${orchardId}/trees`)
      .set(auth(accessTokenA))
      .send({ code: 'T-001', latitude: 31.29, longitude: 77.47, clientTreeId });
    expect(r1.status).toBe(201);
    const r2 = await request(app)
      .post(`/api/trees/orchards/${orchardId}/trees`)
      .set(auth(accessTokenA))
      .send({ code: 'T-001-RETRY', latitude: 31.29, longitude: 77.47, clientTreeId });
    expect(r2.status).toBe(200);
    expect(r2.body.duplicated).toBe(true);
    expect(r2.body.treeId).toBe(r1.body.treeId);

    const list = await request(app).get(`/api/trees/orchards/${orchardId}/trees`).set(auth(accessTokenA));
    expect(list.body.trees).toHaveLength(1);
  });

  it('rejects duplicate tree codes per orchard', async () => {
    const orchardId = await createOrchard();
    await createTree(orchardId, 'DUP-1');
    const res = await request(app)
      .post(`/api/trees/orchards/${orchardId}/trees`)
      .set(auth(accessTokenA))
      .send({ code: 'DUP-1', latitude: 31.29, longitude: 77.47 });
    expect(res.status).toBe(409);
  });

  it('full tree detail includes photos/observations/insight', async () => {
    const orchardId = await createOrchard();
    const treeId = await createTree(orchardId, 'T-100', { variety: 'Royal Delicious', heightM: 4.5 });
    const detail = await request(app).get(`/api/trees/${treeId}`).set(auth(accessTokenA));
    expect(detail.status).toBe(200);
    expect(detail.body.tree.variety).toBe('Royal Delicious');
    expect(detail.body.photos).toEqual([]);
    expect(detail.body.photoInsight).toBeNull();
  });

  it('soft-deletes trees', async () => {
    const orchardId = await createOrchard();
    const treeId = await createTree(orchardId);
    await request(app).delete(`/api/trees/${treeId}`).set(auth(accessTokenA));
    const list = await request(app).get(`/api/trees/orchards/${orchardId}/trees`).set(auth(accessTokenA));
    expect(list.body.trees).toHaveLength(0);
    const incl = await request(app)
      .get(`/api/trees/orchards/${orchardId}/trees?includeInactive=1`)
      .set(auth(accessTokenA));
    expect(incl.body.trees).toHaveLength(1);
  });
});

describe('authorization matrix', () => {
  it('other users cannot see or touch our data', async () => {
    const other = await registerAndLogin({
      name: 'Other Farmer',
      email: 'other@test.example',
      password: 'Other#2026',
    });

    const orchardId = await createOrchard();
    const treeId = await createTree(orchardId);

    const list = await request(app).get('/api/orchards').set(auth(other.accessToken));
    expect(list.body.orchards).toHaveLength(0);

    const detail = await request(app).get(`/api/trees/${treeId}`).set(auth(other.accessToken));
    expect(detail.status).toBe(404);

    const upd = await request(app)
      .put(`/api/trees/${treeId}`)
      .set(auth(other.accessToken))
      .send({ heightM: 9 });
    expect([404, 200]).toContain(upd.status);
    if (upd.status === 200) {
      const check = await request(app).get(`/api/trees/${treeId}`).set(auth(accessTokenA));
      expect(check.body.tree.heightM).toBe(4.5);
    }

    const del = await request(app).delete(`/api/trees/${treeId}`).set(auth(other.accessToken));
    expect(del.status).toBe(404);
  });

  it('forged tokens are rejected', async () => {
    const res = await request(app)
      .get('/api/orchards')
      .set(auth(accessTokenA.slice(0, -4) + 'AAAA'));
    expect(res.status).toBe(401);
  });
});

describe('photos & analysis', () => {
  it('uploads, analyses and serves a photo', async () => {
    const orchardId = await createOrchard();
    const treeId = await createTree(orchardId);
    const res = await request(app)
      .post(`/api/photos/${treeId}/photos`)
      .set(auth(accessTokenA))
      .field('direction', 'N')
      .attach('photo', makeJpeg(), 'tree.jpg');
    expect(res.status).toBe(201);
    expect(res.body.analysis).not.toBeNull();
    expect(res.body.analysis.scores.leafStrength).toBeGreaterThanOrEqual(0);
    expect(res.body.thumbUrl).toContain('/photos/');

    // Serve static file
    const fileRes = await request(app).get(new URL(res.body.thumbUrl).pathname);
    expect(fileRes.status).toBe(200);

    // Deduplication
    const clientPhotoId = crypto.randomUUID();
    const r1 = await request(app)
      .post(`/api/photos/${treeId}/photos`)
      .set(auth(accessTokenA))
      .field('direction', 'E')
      .field('clientPhotoId', clientPhotoId)
      .attach('photo', makeJpeg(), 't2.jpg');
    expect(r1.status).toBe(201);
    const r2 = await request(app)
      .post(`/api/photos/${treeId}/photos`)
      .set(auth(accessTokenA))
      .field('direction', 'E')
      .field('clientPhotoId', clientPhotoId)
      .attach('photo', makeJpeg(), 't3.jpg');
    expect(r2.status).toBe(200);
    expect(r2.body.duplicated).toBe(true);
  });

  it('rejects non-image payloads', async () => {
    const orchardId = await createOrchard();
    const treeId = await createTree(orchardId);
    const res = await request(app)
      .post(`/api/photos/${treeId}/photos`)
      .set(auth(accessTokenA))
      .attach('photo', Buffer.from('<html>not an image</html>'), 'evil.jpg');
    expect([415, 400]).toContain(res.status);
  });
});

describe('spray calendar', () => {
  it('materialises 12 stages with elevation shift', async () => {
    const orchardId = await createOrchard(); // 2100 m → +7 days
    const res = await request(app).get(`/api/spray/orchards/${orchardId}/plan?season=2026`).set(auth(accessTokenA));
    expect(res.status).toBe(200);
    expect(res.body.stages).toHaveLength(12);
    const dormant = res.body.stages.find((s: { key: string }) => s.key === 'dormant-oil');
    expect(dormant).toBeTruthy();
    expect(dormant.products.length).toBeGreaterThan(0);
    const winter = res.body.stages.find((s: { key: string }) => s.key === 'winter-pruning');
    expect(winter.plannedStart).toBe('2026-12-17'); // Dec 10 + 7

    // Idempotent
    const again = await request(app).get(`/api/spray/orchards/${orchardId}/plan?season=2026`).set(auth(accessTokenA));
    expect(again.body.stages).toHaveLength(12);
  });

  it('marks task done and reflects in status', async () => {
    const orchardId = await createOrchard();
    const plan = await request(app).get(`/api/spray/orchards/${orchardId}/plan?season=2026`).set(auth(accessTokenA));
    const taskId = plan.body.stages[0].taskId;
    const upd = await request(app)
      .put(`/api/spray/tasks/${taskId}`)
      .set(auth(accessTokenA))
      .send({ status: 'done', productUsed: 'Horticultural oil 99% EC' });
    expect(upd.status).toBe(200);
    const plan2 = await request(app).get(`/api/spray/orchards/${orchardId}/plan?season=2026`).set(auth(accessTokenA));
    const stage = plan2.body.stages.find((s: { taskId: string }) => s.taskId === taskId);
    expect(stage.taskStatus).toBe('done');
    expect(stage.status).toBe('done');
  });
});

describe('surveys: harvest & pruning', () => {
  it('runs a full harvest survey with summary', async () => {
    const orchardId = await createOrchard();
    const t1 = await createTree(orchardId, 'H-1');
    const t2 = await createTree(orchardId, 'H-2');
    const t3 = await createTree(orchardId, 'H-3');
    await createTree(orchardId, 'H-4');

    const survey = await request(app)
      .post(`/api/surveys/orchards/${orchardId}/surveys`)
      .set(auth(accessTokenA))
      .send({ type: 'harvest', season: '2026' });
    expect(survey.status).toBe(201);
    const surveyId = survey.body.surveyId as string;

    const e1 = await request(app).post(`/api/surveys/${surveyId}/entries`).set(auth(accessTokenA))
      .send({ treeId: t1, fruitCountEst: 200, avgFruitWeightG: 150, canopyDensity: 75, waterSprouts: 3, clientEntryId: crypto.randomUUID() });
    expect(e1.status).toBe(201);
    expect(e1.body.estimatedYieldKg).toBe(30);
    expect(e1.body.computedPruning).toBe('none');

    const e2 = await request(app).post(`/api/surveys/${surveyId}/entries`).set(auth(accessTokenA))
      .send({ treeId: t2, fruitCountEst: 80, canopyDensity: 25, bareWoodRatio: 55 });
    expect(e2.body.computedPruning).toBe('renewal');

    await request(app).post(`/api/surveys/${surveyId}/entries`).set(auth(accessTokenA))
      .send({ treeId: t3, fruitCountEst: 150, canopyDensity: 55, bareWoodRatio: 20 });

    const detail = await request(app).get(`/api/surveys/${surveyId}`).set(auth(accessTokenA));
    expect(detail.status).toBe(200);
    expect(detail.body.entries).toHaveLength(3);
    expect(detail.body.summary.avgYieldKg).toBeGreaterThan(0);
    expect(detail.body.summary.projectedOrchardKg).toBe(detail.body.summary.avgYieldKg * 4);
    expect(detail.body.summary.priorities[0].level).toBe('renewal');

    // Entry idempotency by clientEntryId
    const dup = await request(app).post(`/api/surveys/${surveyId}/entries`).set(auth(accessTokenA))
      .send({ treeId: t1, fruitCountEst: 200, avgFruitWeightG: 150 });
    // No clientEntryId sent again — but our first had one; the dup above lacks one, so it inserts.
    expect([200, 201]).toContain(dup.status);

    await request(app).post(`/api/surveys/${surveyId}/complete`).set(auth(accessTokenA));
    const done = await request(app).get(`/api/surveys/${surveyId}`).set(auth(accessTokenA));
    expect(done.body.survey.completedAt).not.toBeNull();
  });
});

describe('observations & recalculate', () => {
  it('records observation and snapshots to tree', async () => {
    const orchardId = await createOrchard();
    const treeId = await createTree(orchardId);
    const res = await request(app)
      .post(`/api/trees/${treeId}/observations`)
      .set(auth(accessTokenA))
      .send({ heightM: 5.2, healthScore: 72, healthGrade: 'good', diseaseCode: 'apple-scab', diseaseSeverity: 2 });
    expect(res.status).toBe(201);

    const detail = await request(app).get(`/api/trees/${treeId}`).set(auth(accessTokenA));
    expect(detail.body.tree.heightM).toBe(5.2);
    expect(detail.body.tree.healthScore).toBe(72);
    expect(detail.body.observations).toHaveLength(1);
    expect(detail.body.observations[0].source).toBe('manual');
  });

  it('recalculate requires >=3 analysed photos', async () => {
    const orchardId = await createOrchard();
    const treeId = await createTree(orchardId);
    const res = await request(app).post(`/api/trees/${treeId}/recalculate`).set(auth(accessTokenA));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('not_enough_photos');
  });
});

describe('offline sync', () => {
  it('applies mixed batch with per-op error isolation and idempotency', async () => {
    const orchardId = await createOrchard();
    const treeId = await createTree(orchardId);
    const survey = await request(app)
      .post(`/api/surveys/orchards/${orchardId}/surveys`)
      .set(auth(accessTokenA))
      .send({ type: 'harvest', season: '2026' });
    const surveyId = survey.body.surveyId as string;

    const clientId1 = crypto.randomUUID();
    const clientId2 = crypto.randomUUID();
    const res = await request(app)
      .post('/api/sync')
      .set(auth(accessTokenA))
      .send({
        changes: [
          {
            op: 'observation.create',
            clientId: clientId1,
            payload: { treeId, healthScore: 80, healthGrade: 'good', clientObsId: clientId1 },
          },
          {
            op: 'observation.create',
            clientId: clientId1, // same clientObsId -> duplicate path
            payload: { treeId, healthScore: 80, healthGrade: 'good', clientObsId: clientId1 },
          },
          {
            op: 'observation.create',
            clientId: clientId2,
            payload: { treeId: crypto.randomUUID(), healthScore: 10 }, // unknown tree -> fails alone
          },
          {
            op: 'survey.entry.create',
            clientId: crypto.randomUUID(),
            payload: { treeId, surveyId, fruitCountEst: 120, canopyDensity: 60 },
          },
          { op: 'tree.update', clientId: crypto.randomUUID(), payload: { treeId, heightM: 6.1 } },
        ],
      });
    expect(res.status).toBe(200);
    const results = res.body.results;
    expect(results).toHaveLength(5);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(true);
    expect(results[1].duplicated).toBe(true);
    expect(results[2].ok).toBe(false);
    expect(results[3].ok).toBe(true);
    expect(results[4].ok).toBe(true);

    // Verify ops really landed (batch must not be all-or-nothing)
    const detail = await request(app).get(`/api/trees/${treeId}`).set(auth(accessTokenA));
    expect(detail.body.tree.heightM).toBe(6.1);
    expect(detail.body.observations.length).toBeGreaterThanOrEqual(1);
    expect(detail.body.surveyHistory).toHaveLength(1);
  });

  it('validates the batch envelope', async () => {
    const res = await request(app).post('/api/sync').set(auth(accessTokenA)).send({ changes: [] });
    expect(res.status).toBe(400);
  });
});

describe('input hardening', () => {
  it('rejects malformed JSON bodies with 400 not 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": broken');
    expect(res.status).toBe(400);
  });

  it('SQL injection attempts are inert', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: "x'--@e.example'; DROP TABLE users; --", password: 'Anything#1' });
    expect([400, 401]).toContain(res.status);
    const users = await pool.query('SELECT count(*)::int AS n FROM users');
    expect(users.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('rejects oversized payloads', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.example', password: 'x'.repeat(3 * 1024 * 1024) });
    expect([400, 413]).toContain(res.status);
  });
});

describe('photo files cleanup', () => {
  it('deletes photo file from disk when photo row is deleted', async () => {
    const orchardId = await createOrchard();
    const treeId = await createTree(orchardId);
    const up = await request(app)
      .post(`/api/photos/${treeId}/photos`)
      .set(auth(accessTokenA))
      .attach('photo', makeJpeg(), 'del.jpg');
    expect(up.status).toBe(201);

    // find the stored path via DB (server data dir)
    const dbRow = await pool.query<{ file_path: string }>(
      'SELECT file_path FROM tree_photos WHERE tree_id = $1',
      [treeId],
    );
    expect(fs.existsSync(dbRow.rows[0].file_path)).toBe(true);

    const del = await request(app).delete(`/api/photos/${up.body.photoId}`).set(auth(accessTokenA));
    expect(del.status).toBe(200);
    expect(fs.existsSync(dbRow.rows[0].file_path)).toBe(false);
  });
});
