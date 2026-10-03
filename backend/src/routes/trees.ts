import { Router } from 'express';
import path from 'node:path';
import { config } from '../config';
import { query, type DbClient } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/error';
import { getOwnedOrchard, getOwnedTree } from '../repo';
import { aggregateAnalyses } from '../services/imageAnalysis';
import type { PhotoAnalysis } from '../types';
import { observationCreateSchema, treeCreateSchema, treeUpdateSchema } from '../validation';

export const treesRouter = Router();
treesRouter.use(requireAuth);

export function photoUrl(relPath: string | null): string | null {
  if (!relPath) return null;
  const rel = path.relative(config.photosDir, relPath).replaceAll('\\', '/');
  return `${config.publicBaseUrl}/photos/${rel}`;
}

interface TreeListRow {
  id: string;
  code: string;
  variety: string | null;
  block: string | null;
  latitude: number;
  longitude: number;
  height_m: string | null;
  canopy_diameter_m: string | null;
  health_grade: string | null;
  health_score: number | null;
  leaf_strength_score: number | null;
  disease_code: string | null;
  disease_severity: number | null;
  is_active: boolean;
  last_assessed_at: Date | null;
  photo_count: string;
}

/** Insert a tree; idempotent when clientTreeId was already synced. */
export async function insertTree(
  client: DbClient | undefined,
  userId: string,
  orchardId: string,
  body: ReturnType<typeof treeCreateSchema.parse>,
): Promise<{ treeId: string; duplicated: boolean }> {
  await getOwnedOrchard(orchardId, userId, client);
  if (body.clientTreeId) {
    const existing = await query<{ id: string }>(
      'SELECT id FROM trees WHERE client_tree_id = $1',
      [body.clientTreeId],
      client,
    );
    if (existing.length > 0) return { treeId: existing[0].id, duplicated: true };
  }
  const rows = await query<{ id: string }>(
    `INSERT INTO trees (orchard_id, client_tree_id, code, variety, rootstock, planted_year, block,
                        latitude, longitude, gps_accuracy_m, height_m, trunk_girth_cm, canopy_diameter_m,
                        health_grade, health_score, leaf_strength_score, disease_code, disease_severity,
                        disease_notes, notes, last_assessed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
             CASE WHEN $14 IS NULL AND $15 IS NULL AND $16 IS NULL AND $17 IS NULL THEN NULL ELSE now() END)
     RETURNING id`,
    [
      orchardId, body.clientTreeId ?? null, body.code, body.variety ?? null, body.rootstock ?? null,
      body.plantedYear ?? null, body.block ?? null, body.latitude, body.longitude, body.gpsAccuracyM ?? null,
      body.heightM ?? null, body.trunkGirthCm ?? null, body.canopyDiameterM ?? null,
      body.healthGrade ?? null, body.healthScore ?? null, body.leafStrengthScore ?? null,
      body.diseaseCode ?? null, body.diseaseSeverity ?? null, body.diseaseNotes ?? null, body.notes ?? null,
    ],
    client,
  );
  return { treeId: rows[0].id, duplicated: false };
}

treesRouter.get(
  '/orchards/:orchardId/trees',
  asyncHandler(async (req, res) => {
    await getOwnedOrchard(req.params.orchardId, req.user!.id);
    const includeInactive = req.query.includeInactive === '1';
    const rows = await query<TreeListRow>(
      `SELECT t.id, t.code, t.variety, t.block, t.latitude, t.longitude, t.height_m, t.canopy_diameter_m,
              t.health_grade, t.health_score, t.leaf_strength_score, t.disease_code, t.disease_severity,
              t.is_active, t.last_assessed_at,
              (SELECT count(*) FROM tree_photos p WHERE p.tree_id = t.id) AS photo_count
       FROM trees t
       WHERE t.orchard_id = $1 ${includeInactive ? '' : 'AND t.is_active'}
       ORDER BY t.code`,
      [req.params.orchardId],
    );
    res.json({
      trees: rows.map((r) => ({
        id: r.id,
        code: r.code,
        variety: r.variety,
        block: r.block,
        latitude: r.latitude,
        longitude: r.longitude,
        heightM: r.height_m != null ? parseFloat(r.height_m) : null,
        canopyDiameterM: r.canopy_diameter_m != null ? parseFloat(r.canopy_diameter_m) : null,
        healthGrade: r.health_grade,
        healthScore: r.health_score,
        leafStrengthScore: r.leaf_strength_score,
        diseaseCode: r.disease_code,
        diseaseSeverity: r.disease_severity,
        isActive: r.is_active,
        lastAssessedAt: r.last_assessed_at,
        photoCount: parseInt(r.photo_count, 10),
      })),
    });
  }),
);

treesRouter.post(
  '/orchards/:orchardId/trees',
  asyncHandler(async (req, res) => {
    const body = treeCreateSchema.parse(req.body);
    const result = await insertTree(undefined, req.user!.id, req.params.orchardId, body);
    res.status(result.duplicated ? 200 : 201).json(result);
  }),
);

/** Assemble the full tree catalog: attributes, photos, observations, photo insight. */
treesRouter.get(
  '/:treeId',
  asyncHandler(async (req, res) => {
    const { tree } = await getOwnedTree(req.params.treeId, req.user!.id);

    const [photos, observations, surveyRows] = await Promise.all([
      query<{
        id: string; direction: string; heading_deg: number | null; file_path: string;
        thumb_path: string | null; width: number | null; height: number | null;
        captured_at: Date | null; uploaded_at: Date; analysis: PhotoAnalysis | null;
      }>(
        `SELECT id, direction, heading_deg, file_path, thumb_path, width, height, captured_at, uploaded_at, analysis
         FROM tree_photos WHERE tree_id = $1 ORDER BY uploaded_at DESC`,
        [tree.id],
      ),
      query(
        `SELECT id, observed_at, source, height_m, health_score, health_grade, leaf_strength_score,
                disease_code, disease_severity, notes
         FROM observations WHERE tree_id = $1 ORDER BY observed_at DESC LIMIT 100`,
        [tree.id],
      ),
      query(
        `SELECT e.id, s.type, s.season, e.estimated_yield_kg, e.computed_pruning, e.canopy_density, e.recorded_at
         FROM survey_entries e JOIN surveys s ON s.id = e.survey_id
         WHERE e.tree_id = $1 ORDER BY e.recorded_at DESC LIMIT 20`,
        [tree.id],
      ),
    ]);

    const photoAnalyses = photos
      .filter((p) => p.analysis != null)
      .map((p) => ({ direction: p.direction, analysis: p.analysis as PhotoAnalysis }));
    const insight = aggregateAnalyses(photoAnalyses);

    res.json({
      tree: {
        id: tree.id,
        orchardId: tree.orchard_id,
        code: tree.code,
        variety: tree.variety,
        rootstock: tree.rootstock,
        plantedYear: tree.planted_year,
        block: tree.block,
        latitude: tree.latitude,
        longitude: tree.longitude,
        gpsAccuracyM: tree.gps_accuracy_m,
        heightM: tree.height_m != null ? parseFloat(tree.height_m) : null,
        trunkGirthCm: tree.trunk_girth_cm != null ? parseFloat(tree.trunk_girth_cm) : null,
        canopyDiameterM: tree.canopy_diameter_m != null ? parseFloat(tree.canopy_diameter_m) : null,
        healthGrade: tree.health_grade,
        healthScore: tree.health_score,
        leafStrengthScore: tree.leaf_strength_score,
        diseaseCode: tree.disease_code,
        diseaseSeverity: tree.disease_severity,
        diseaseNotes: tree.disease_notes,
        notes: tree.notes,
        isActive: tree.is_active,
        createdAt: tree.created_at,
        updatedAt: tree.updated_at,
        lastAssessedAt: tree.last_assessed_at,
      },
      photos: photos.map((p) => ({
        id: p.id,
        direction: p.direction,
        headingDeg: p.heading_deg,
        url: photoUrl(p.file_path),
        thumbUrl: photoUrl(p.thumb_path),
        width: p.width,
        height: p.height,
        capturedAt: p.captured_at,
        uploadedAt: p.uploaded_at,
        analysis: p.analysis,
      })),
      observations: observations.map((o) => ({
        id: o.id,
        observedAt: o.observed_at,
        source: o.source,
        heightM: o.height_m != null ? parseFloat(o.height_m) : null,
        healthScore: o.health_score,
        healthGrade: o.health_grade,
        leafStrengthScore: o.leaf_strength_score,
        diseaseCode: o.disease_code,
        diseaseSeverity: o.disease_severity,
        notes: o.notes,
      })),
      surveyHistory: surveyRows.map((e) => ({
        id: e.id,
        type: e.type,
        season: e.season,
        yieldKg: e.estimated_yield_kg != null ? parseFloat(e.estimated_yield_kg) : null,
        pruning: e.computed_pruning,
        canopyDensity: e.canopy_density,
        recordedAt: e.recorded_at,
      })),
      photoInsight: insight,
    });
  }),
);

treesRouter.put(
  '/:treeId',
  asyncHandler(async (req, res) => {
    const body = treeUpdateSchema.parse(req.body);
    await getOwnedTree(req.params.treeId, req.user!.id);
    const rows = await query(
      `UPDATE trees SET
         code = COALESCE($2, code), variety = COALESCE($3, variety), rootstock = COALESCE($4, rootstock),
         planted_year = COALESCE($5, planted_year), block = COALESCE($6, block),
         latitude = COALESCE($7, latitude), longitude = COALESCE($8, longitude),
         gps_accuracy_m = COALESCE($9, gps_accuracy_m), height_m = COALESCE($10, height_m),
         trunk_girth_cm = COALESCE($11, trunk_girth_cm), canopy_diameter_m = COALESCE($12, canopy_diameter_m),
         health_grade = COALESCE($13, health_grade), health_score = COALESCE($14, health_score),
         leaf_strength_score = COALESCE($15, leaf_strength_score), disease_code = COALESCE($16, disease_code),
         disease_severity = COALESCE($17, disease_severity), disease_notes = COALESCE($18, disease_notes),
         notes = COALESCE($19, notes), is_active = COALESCE($20, is_active), updated_at = now()
       WHERE id = $1 RETURNING id`,
      [
        req.params.treeId, body.code ?? null, body.variety ?? null, body.rootstock ?? null,
        body.plantedYear ?? null, body.block ?? null, body.latitude ?? null, body.longitude ?? null,
        body.gpsAccuracyM ?? null, body.heightM ?? null, body.trunkGirthCm ?? null, body.canopyDiameterM ?? null,
        body.healthGrade ?? null, body.healthScore ?? null, body.leafStrengthScore ?? null,
        body.diseaseCode ?? null, body.diseaseSeverity ?? null, body.diseaseNotes ?? null,
        body.notes ?? null, body.isActive ?? null,
      ],
    );
    res.json({ ok: rows.length > 0 });
  }),
);

treesRouter.delete(
  '/:treeId',
  asyncHandler(async (req, res) => {
    await getOwnedTree(req.params.treeId, req.user!.id);
    await query('UPDATE trees SET is_active = false, updated_at = now() WHERE id = $1', [req.params.treeId]);
    res.json({ ok: true });
  }),
);

/** Record a manual assessment; snapshots onto the tree row. */
treesRouter.post(
  '/:treeId/observations',
  asyncHandler(async (req, res) => {
    const body = observationCreateSchema.parse(req.body);
    const { tree } = await getOwnedTree(req.params.treeId, req.user!.id);
    await query(
      `INSERT INTO observations (tree_id, client_obs_id, observed_at, source, height_m, health_score,
                                 health_grade, leaf_strength_score, disease_code, disease_severity, notes)
       VALUES ($1,$2,COALESCE($3, now()),'manual',$4,$5,$6,$7,$8,$9,$10)`,
      [
        tree.id, body.clientObsId ?? null, body.observedAt ?? null, body.heightM ?? null,
        body.healthScore ?? null, body.healthGrade ?? null, body.leafStrengthScore ?? null,
        body.diseaseCode ?? null, body.diseaseSeverity ?? null, body.notes ?? null,
      ],
    );
    await query(
      `UPDATE trees SET
         height_m = COALESCE($2, height_m), health_score = COALESCE($3, health_score),
         health_grade = COALESCE($4, health_grade), leaf_strength_score = COALESCE($5, leaf_strength_score),
         disease_code = COALESCE($6, disease_code), disease_severity = COALESCE($7, disease_severity),
         last_assessed_at = now(), updated_at = now()
       WHERE id = $1`,
      [
        tree.id, body.heightM ?? null, body.healthScore ?? null, body.healthGrade ?? null,
        body.leafStrengthScore ?? null, body.diseaseCode ?? null, body.diseaseSeverity ?? null,
      ],
    );
    res.status(201).json({ ok: true });
  }),
);

/** Re-derive health metrics from the tree's photo set (>=3 photos required). */
treesRouter.post(
  '/:treeId/recalculate',
  asyncHandler(async (req, res) => {
    const { tree } = await getOwnedTree(req.params.treeId, req.user!.id);
    const photos = await query<{ direction: string; analysis: PhotoAnalysis | null }>(
      `SELECT direction, analysis FROM tree_photos
       WHERE tree_id = $1 AND analysis IS NOT NULL AND uploaded_at > now() - interval '365 days'`,
      [tree.id],
    );
    const insight = aggregateAnalyses(
      photos.filter((p) => p.analysis != null) as { direction: string; analysis: PhotoAnalysis }[],
    );
    if (!insight || insight.photoCount < 3) {
      throw new ApiError(400, 'not_enough_photos', 'Upload at least 3 analysed photos first');
    }
    await query(
      `INSERT INTO observations (tree_id, source, health_score, health_grade, leaf_strength_score, notes)
       VALUES ($1, 'photo', $2, $3, $4, $5)`,
      [tree.id, insight.leafStrengthScore, insight.healthGradeHint, insight.leafStrengthScore, insight.note],
    );
    await query(
      `UPDATE trees SET health_score = COALESCE($2, health_score), health_grade = COALESCE($3, health_grade),
         leaf_strength_score = COALESCE($4, leaf_strength_score), last_assessed_at = now(), updated_at = now()
       WHERE id = $1`,
      [tree.id, insight.leafStrengthScore, insight.healthGradeHint, insight.leafStrengthScore],
    );
    res.json({ insight });
  }),
);
