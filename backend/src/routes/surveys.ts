/** Field surveys: harvest (fruit counts -> kg) and pruning (canopy/bare-wood/sprouts -> verdict).
 *  Yield + pruning verdicts are computed SERVER-SIDE (yieldService) so app and reports agree.
 *  Entry insert is shared with the offline sync path and is idempotent per clientEntryId. */
import { Router } from 'express';
import { param } from '../params';
import { query, withTransaction, type DbClient } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/error';
import { countActiveTrees, getOwnedOrchard, getOwnedTree } from '../repo';
import { estimateYieldKg, pruningVerdict, surveySummary } from '../services/yieldService';
import { surveyCreateSchema, surveyEntryCreateSchema } from '../validation';

export const surveysRouter = Router();
surveysRouter.use(requireAuth);

interface SurveyEntryRow {
  id: string;
  tree_id: string;
  fruit_count_est: number | null;
  avg_fruit_weight_g: number | null;
  canopy_density: number | null;
  bare_wood_ratio: number | null;
  water_sprouts: number | null;
  pruning_needed: string | null;
  computed_pruning: string | null;
  pruning_reason: string | null;
  estimated_yield_kg: string | null;
  notes: string | null;
  recorded_at: Date;
  tree_code: string;
  variety: string | null;
}

surveysRouter.post(
  '/orchards/:orchardId/surveys',
  asyncHandler(async (req, res) => {
    const body = surveyCreateSchema.parse(req.body);
    await getOwnedOrchard(param(req, 'orchardId'), req.user!.id);
    const rows = await query<{ id: string; started_at: Date }>(
      `INSERT INTO surveys (orchard_id, type, season, notes) VALUES ($1, $2, $3, $4) RETURNING id, started_at`,
      [param(req, 'orchardId'), body.type, body.season, body.notes ?? null],
    );
    res.status(201).json({ surveyId: rows[0].id, startedAt: rows[0].started_at });
  }),
);

surveysRouter.get(
  '/orchards/:orchardId/surveys',
  asyncHandler(async (req, res) => {
    await getOwnedOrchard(param(req, 'orchardId'), req.user!.id);
    const rows = await query<{
      id: string; type: string; season: string; started_at: Date; completed_at: Date | null; entries: string;
    }>(
      `SELECT s.id, s.type, s.season, s.started_at, s.completed_at,
              (SELECT count(*) FROM survey_entries e WHERE e.survey_id = s.id) AS entries
       FROM surveys s WHERE s.orchard_id = $1 ORDER BY s.started_at DESC`,
      [param(req, 'orchardId')],
    );
    res.json({
      surveys: rows.map((s) => ({
        id: s.id,
        type: s.type,
        season: s.season,
        startedAt: s.started_at,
        completedAt: s.completed_at,
        entryCount: parseInt(s.entries, 10),
      })),
    });
  }),
);

/** Shared entry-insert used by both the REST route and the offline sync path. */
export async function insertSurveyEntry(
  client: DbClient | undefined,
  userId: string,
  payload: ReturnType<typeof surveyEntryCreateSchema.parse> & { surveyId: string },
): Promise<{ entryId: string; duplicated: boolean; estimatedYieldKg: number | null; computedPruning: string; pruningReason: string }> {
  const surveyRows = await query<{ id: string; orchard_id: string }>(
    'SELECT id, orchard_id FROM surveys WHERE id = $1',
    [payload.surveyId],
    client,
  );
  if (surveyRows.length === 0) throw new ApiError(404, 'survey_not_found', 'Survey not found');
  await getOwnedOrchard(surveyRows[0].orchard_id, userId, client);

  if (payload.clientEntryId) {
    const dup = await query<{ id: string }>('SELECT id FROM survey_entries WHERE client_entry_id = $1', [
      payload.clientEntryId,
    ], client);
    if (dup.length > 0) {
      return { entryId: dup[0].id, duplicated: true, estimatedYieldKg: null, computedPruning: '', pruningReason: '' };
    }
  }

  const tree = await getOwnedTree(payload.treeId, userId, client);
  if (tree.tree.orchard_id !== surveyRows[0].orchard_id) {
    throw new ApiError(400, 'tree_not_in_orchard', 'Tree does not belong to this orchard');
  }

  const yieldKg = estimateYieldKg(payload.fruitCountEst, payload.avgFruitWeightG);
  const verdict = pruningVerdict({
    canopyDensity: payload.canopyDensity,
    bareWoodRatio: payload.bareWoodRatio,
    waterSprouts: payload.waterSprouts,
    healthScore: tree.tree.health_score,
  });
  const level = payload.pruningNeeded ?? verdict.level;

  const rows = await query<{ id: string }>(
    `INSERT INTO survey_entries (survey_id, tree_id, client_entry_id, fruit_count_est, avg_fruit_weight_g,
                                 canopy_density, bare_wood_ratio, water_sprouts, pruning_needed,
                                 computed_pruning, pruning_reason, estimated_yield_kg, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      payload.surveyId, payload.treeId, payload.clientEntryId ?? null, payload.fruitCountEst ?? null,
      payload.avgFruitWeightG ?? null, payload.canopyDensity ?? null, payload.bareWoodRatio ?? null,
      payload.waterSprouts ?? null, level, verdict.level, verdict.reason, yieldKg, payload.notes ?? null,
    ],
    client,
  );
  return {
    entryId: rows[0].id,
    duplicated: false,
    estimatedYieldKg: yieldKg,
    computedPruning: verdict.level,
    pruningReason: verdict.reason,
  };
}

surveysRouter.post(
  '/:surveyId/entries',
  asyncHandler(async (req, res) => {
    const body = surveyEntryCreateSchema.parse(req.body);
    const result = await insertSurveyEntry(undefined, req.user!.id, { ...body, surveyId: param(req, 'surveyId') });
    res.status(result.duplicated ? 200 : 201).json(result);
  }),
);

surveysRouter.get(
  '/:surveyId',
  asyncHandler(async (req, res) => {
    const rows = await query<{ id: string; orchard_id: string; type: string; season: string; started_at: Date; completed_at: Date | null; notes: string | null }>(
      'SELECT id, orchard_id, type, season, started_at, completed_at, notes FROM surveys WHERE id = $1',
      [param(req, 'surveyId')],
    );
    if (rows.length === 0) throw new ApiError(404, 'survey_not_found', 'Survey not found');
    const survey = rows[0];
    await getOwnedOrchard(survey.orchard_id, req.user!.id);

    const entries = await query<SurveyEntryRow>(
      `SELECT e.*, t.code AS tree_code, t.variety
       FROM survey_entries e JOIN trees t ON t.id = e.tree_id
       WHERE e.survey_id = $1 ORDER BY e.recorded_at DESC`,
      [param(req, 'surveyId')],
    );
    const total = await countActiveTrees(survey.orchard_id);

    res.json({
      survey: {
        id: survey.id,
        orchardId: survey.orchard_id,
        type: survey.type,
        season: survey.season,
        startedAt: survey.started_at,
        completedAt: survey.completed_at,
        notes: survey.notes,
      },
      totalActiveTrees: total,
      entries: entries.map((e) => ({
        id: e.id,
        treeId: e.tree_id,
        treeCode: e.tree_code,
        variety: e.variety,
        fruitCountEst: e.fruit_count_est,
        avgFruitWeightG: e.avg_fruit_weight_g,
        canopyDensity: e.canopy_density,
        bareWoodRatio: e.bare_wood_ratio,
        waterSprouts: e.water_sprouts,
        pruningNeeded: e.pruning_needed,
        computedPruning: e.computed_pruning,
        pruningReason: e.pruning_reason,
        yieldKg: e.estimated_yield_kg != null ? parseFloat(e.estimated_yield_kg) : null,
        notes: e.notes,
        recordedAt: e.recorded_at,
      })),
      summary: surveySummary(
        entries.map((e) => ({
          tree_id: e.tree_id,
          estimated_yield_kg: e.estimated_yield_kg != null ? parseFloat(e.estimated_yield_kg) : null,
          canopy_density: e.canopy_density,
          computed_pruning: e.computed_pruning,
        })),
        total,
      ),
    });
  }),
);

surveysRouter.post(
  '/:surveyId/complete',
  asyncHandler(async (req, res) => {
    const rows = await query<{ orchard_id: string }>('SELECT orchard_id FROM surveys WHERE id = $1', [
      param(req, 'surveyId'),
    ]);
    if (rows.length === 0) throw new ApiError(404, 'survey_not_found', 'Survey not found');
    await getOwnedOrchard(rows[0].orchard_id, req.user!.id);
    await query('UPDATE surveys SET completed_at = now() WHERE id = $1 AND completed_at IS NULL', [
      param(req, 'surveyId'),
    ]);
    res.json({ ok: true });
  }),
);
