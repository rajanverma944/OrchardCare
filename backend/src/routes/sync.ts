import { Router } from 'express';
import { query, withTransaction } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { insertTree } from './trees';
import { insertSurveyEntry } from './surveys';
import {
  observationCreateSchema,
  sprayTaskUpdateSchema,
  surveyEntryCreateSchema,
  syncSchema,
  treeCreateSchema,
  treeUpdateSchema,
} from '../validation';

/**
 * Offline queue flush: applies an ordered batch of mutations, each keyed by a
 * client-generated clientId so retries never duplicate data. The batch runs in
 * one transaction; each op sits in its own savepoint so a single bad op fails
 * alone without losing the ops around it.
 */

interface SyncResult {
  clientId: string;
  ok: boolean;
  serverId?: string;
  duplicated?: boolean;
  error?: { code: string; message: string };
}

async function ownTreeGuard(
  client: Parameters<Parameters<typeof withTransaction>[0]>[0],
  treeId: string,
  userId: string,
): Promise<void> {
  const own = await query<{ owner_id: string }>(
    `SELECT o.owner_id FROM trees t JOIN orchards o ON o.id = t.orchard_id WHERE t.id = $1`,
    [treeId],
    client,
  );
  if (own.length === 0 || own[0].owner_id !== userId) throw new Error('not_found');
}

export const syncRouter = Router();
syncRouter.use(requireAuth);

syncRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = syncSchema.parse(req.body);
    const userId = req.user!.id;
    const results: SyncResult[] = [];

    await withTransaction(async (client) => {
      for (const change of body.changes) {
        await client.query('SAVEPOINT op');
        try {
          let serverId: string | undefined;
          let duplicated = false;

          if (change.op === 'tree.create') {
            const p = change.payload as { orchardId?: string } & Record<string, unknown>;
            const parsed = treeCreateSchema.parse(p);
            const orchardId = String(p.orchardId ?? '');
            const r = await insertTree(client, userId, orchardId, parsed);
            serverId = r.treeId;
            duplicated = r.duplicated;
          } else if (change.op === 'tree.update') {
            const p = change.payload as { treeId?: string } & Record<string, unknown>;
            const parsed = treeUpdateSchema.parse(p);
            const treeId = String(p.treeId ?? '');
            await ownTreeGuard(client, treeId, userId);
            await query(
              `UPDATE trees SET code = COALESCE($2, code), variety = COALESCE($3, variety),
                 height_m = COALESCE($4, height_m), trunk_girth_cm = COALESCE($5, trunk_girth_cm),
                 canopy_diameter_m = COALESCE($6, canopy_diameter_m), health_grade = COALESCE($7, health_grade),
                 health_score = COALESCE($8, health_score), leaf_strength_score = COALESCE($9, leaf_strength_score),
                 disease_code = COALESCE($10, disease_code), disease_severity = COALESCE($11, disease_severity),
                 disease_notes = COALESCE($12, disease_notes), notes = COALESCE($13, notes),
                 is_active = COALESCE($14, is_active), updated_at = now()
               WHERE id = $1`,
              [
                treeId, parsed.code ?? null, parsed.variety ?? null, parsed.heightM ?? null,
                parsed.trunkGirthCm ?? null, parsed.canopyDiameterM ?? null, parsed.healthGrade ?? null,
                parsed.healthScore ?? null, parsed.leafStrengthScore ?? null, parsed.diseaseCode ?? null,
                parsed.diseaseSeverity ?? null, parsed.diseaseNotes ?? null, parsed.notes ?? null,
                parsed.isActive ?? null,
              ],
              client,
            );
            serverId = treeId;
          } else if (change.op === 'observation.create') {
            const p = change.payload as { treeId?: string } & Record<string, unknown>;
            const parsed = observationCreateSchema.parse(p);
            const treeId = String(p.treeId ?? '');
            await ownTreeGuard(client, treeId, userId);
            if (parsed.clientObsId) {
              const dup = await query<{ id: string }>(
                'SELECT id FROM observations WHERE client_obs_id = $1',
                [parsed.clientObsId],
                client,
              );
              if (dup.length > 0) {
                results.push({ clientId: change.clientId, ok: true, serverId: dup[0].id, duplicated: true });
                throw new EarlyReturn();
              }
            }
            const ins = await query<{ id: string }>(
              `INSERT INTO observations (tree_id, client_obs_id, observed_at, source, height_m, health_score,
                                         health_grade, leaf_strength_score, disease_code, disease_severity, notes)
               VALUES ($1,$2,COALESCE($3, now()),'manual',$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
              [
                treeId, parsed.clientObsId ?? null, parsed.observedAt ?? null, parsed.heightM ?? null,
                parsed.healthScore ?? null, parsed.healthGrade ?? null, parsed.leafStrengthScore ?? null,
                parsed.diseaseCode ?? null, parsed.diseaseSeverity ?? null, parsed.notes ?? null,
              ],
              client,
            );
            serverId = ins[0].id;
          } else if (change.op === 'survey.entry.create') {
            const p = change.payload as { surveyId?: string } & Record<string, unknown>;
            const parsed = surveyEntryCreateSchema.parse(p);
            const surveyId = String(p.surveyId ?? '');
            if (!surveyId) throw new Error('missing_field:surveyId');
            const r = await insertSurveyEntry(client, userId, { ...parsed, surveyId });
            serverId = r.entryId;
            duplicated = r.duplicated;
          } else if (change.op === 'spray.task.update') {
            const p = change.payload as { taskId?: string } & Record<string, unknown>;
            const parsed = sprayTaskUpdateSchema.parse(p);
            const taskId = String(p.taskId ?? '');
            await query(
              `UPDATE spray_tasks SET status = $2, product_used = $3, notes = $4,
                 completed_at = CASE WHEN $2 = 'done' THEN COALESCE($5::timestamptz, now()) ELSE completed_at END
               FROM orchards o
               WHERE spray_tasks.id = $1 AND spray_tasks.orchard_id = o.id AND o.owner_id = $6`,
              [taskId, parsed.status, parsed.productUsed ?? null, parsed.notes ?? null, parsed.completedAt ?? null, userId],
              client,
            );
            serverId = taskId;
          } else {
            throw new Error(`unknown_op:${change.op}`);
          }

          results.push({ clientId: change.clientId, ok: true, serverId, duplicated });
        } catch (err) {
          if (!(err instanceof EarlyReturn)) {
            await client.query('ROLLBACK TO SAVEPOINT op');
            const message = (err as Error).message ?? 'operation failed';
            const code = message.startsWith('unknown_op')
              ? 'unknown_op'
              : message.startsWith('missing_field')
                ? 'missing_field'
                : message.includes('not_found')
                  ? 'not_found'
                  : 'op_failed';
            results.push({ clientId: change.clientId, ok: false, error: { code, message } });
          }
        } finally {
          await client.query('RELEASE SAVEPOINT op').catch(() => undefined);
        }
      }
    });

    res.json({ results });
  }),
);

/** Thrown to skip the normal result push when a dedupe early-return already pushed it. */
class EarlyReturn extends Error {
  constructor() {
    super('early_return');
  }
}
