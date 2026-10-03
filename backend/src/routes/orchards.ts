import { Router } from 'express';
import { query, withTransaction } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/error';
import { countActiveTrees } from '../repo';
import { orchardCreateSchema, orchardUpdateSchema } from '../validation';

export const orchardsRouter = Router();
orchardsRouter.use(requireAuth);

interface OrchardSummaryRow {
  id: string;
  name: string;
  village: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation_m: number | null;
  area_hectares: string | null;
  created_at: Date;
  tree_count: string;
  avg_health: string | null;
  next_spray_stage: string | null;
  next_spray_date: string | null;
}

function mapSummary(r: OrchardSummaryRow) {
  return {
    id: r.id,
    name: r.name,
    village: r.village,
    latitude: r.latitude,
    longitude: r.longitude,
    elevationM: r.elevation_m,
    areaHectares: r.area_hectares != null ? parseFloat(r.area_hectares) : null,
    createdAt: r.created_at,
    treeCount: parseInt(r.tree_count, 10),
    avgHealthScore: r.avg_health != null ? Math.round(parseFloat(r.avg_health)) : null,
    nextSpray: r.next_spray_stage
      ? { stageKey: r.next_spray_stage, plannedStart: r.next_spray_date }
      : null,
  };
}

orchardsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await query<OrchardSummaryRow>(
      `SELECT o.id, o.name, o.village, o.latitude, o.longitude, o.elevation_m, o.area_hectares, o.created_at,
              (SELECT count(*) FROM trees t WHERE t.orchard_id = o.id AND t.is_active) AS tree_count,
              (SELECT round(avg(t.health_score)) FROM trees t WHERE t.orchard_id = o.id AND t.is_active AND t.health_score IS NOT NULL) AS avg_health,
              (SELECT s.stage_key FROM spray_tasks s
                WHERE s.orchard_id = o.id AND s.status = 'pending' AND s.planned_end >= current_date
                ORDER BY s.planned_start LIMIT 1) AS next_spray_stage,
              (SELECT s.planned_start::text FROM spray_tasks s
                WHERE s.orchard_id = o.id AND s.status = 'pending' AND s.planned_end >= current_date
                ORDER BY s.planned_start LIMIT 1) AS next_spray_date
       FROM orchards o
       WHERE o.owner_id = $1
       ORDER BY o.created_at DESC`,
      [req.user!.id],
    );
    res.json({ orchards: rows.map(mapSummary) });
  }),
);

orchardsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = orchardCreateSchema.parse(req.body);
    const rows = await query<OrchardSummaryRow>(
      `INSERT INTO orchards (owner_id, name, village, latitude, longitude, elevation_m, area_hectares)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, village, latitude, longitude, elevation_m, area_hectares, created_at,
                 '0' AS tree_count, NULL::numeric AS avg_health, NULL::text AS next_spray_stage, NULL::text AS next_spray_date`,
      [req.user!.id, body.name, body.village ?? null, body.latitude ?? null, body.longitude ?? null, body.elevationM ?? null, body.areaHectares ?? null],
    );
    res.status(201).json({ orchard: mapSummary(rows[0]) });
  }),
);

orchardsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const rows = await query<OrchardSummaryRow>(
      `SELECT o.id, o.name, o.village, o.latitude, o.longitude, o.elevation_m, o.area_hectares, o.created_at,
              (SELECT count(*) FROM trees t WHERE t.orchard_id = o.id AND t.is_active) AS tree_count,
              (SELECT round(avg(t.health_score)) FROM trees t WHERE t.orchard_id = o.id AND t.is_active AND t.health_score IS NOT NULL) AS avg_health,
              (SELECT s.stage_key FROM spray_tasks s
                WHERE s.orchard_id = o.id AND s.status = 'pending' AND s.planned_end >= current_date
                ORDER BY s.planned_start LIMIT 1) AS next_spray_stage,
              (SELECT s.planned_start::text FROM spray_tasks s
                WHERE s.orchard_id = o.id AND s.status = 'pending' AND s.planned_end >= current_date
                ORDER BY s.planned_start LIMIT 1) AS next_spray_date
       FROM orchards o
       WHERE o.id = $1 AND o.owner_id = $2`,
      [req.params.id, req.user!.id],
    );
    if (rows.length === 0) throw new ApiError(404, 'orchard_not_found', 'Orchard not found');

    const surveyRows = await query<{ id: string; type: string; season: string; started_at: Date; completed_at: Date | null; entries: string }>(
      `SELECT s.id, s.type, s.season, s.started_at, s.completed_at,
              (SELECT count(*) FROM survey_entries e WHERE e.survey_id = s.id) AS entries
       FROM surveys s WHERE s.orchard_id = $1
       ORDER BY s.started_at DESC LIMIT 5`,
      [req.params.id],
    );
    res.json({
      orchard: mapSummary(rows[0]),
      recentSurveys: surveyRows.map((s) => ({
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

orchardsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = orchardUpdateSchema.parse(req.body);
    const rows = await query('UPDATE orchards SET name = COALESCE($2, name), village = COALESCE($3, village), latitude = COALESCE($4, latitude), longitude = COALESCE($5, longitude), elevation_m = COALESCE($6, elevation_m), area_hectares = COALESCE($7, area_hectares), updated_at = now() WHERE id = $1 AND owner_id = $8 RETURNING id', [req.params.id, body.name ?? null, body.village ?? null, body.latitude ?? null, body.longitude ?? null, body.elevationM ?? null, body.areaHectares ?? null, req.user!.id]);
    if (rows.length === 0) throw new ApiError(404, 'orchard_not_found', 'Orchard not found');
    res.json({ ok: true });
  }),
);

orchardsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // Photo files are deleted best-effort after the cascade removes the rows.
    const photoRows = await query<{ file_path: string; thumb_path: string | null }>(
      `SELECT p.file_path, p.thumb_path FROM tree_photos p
       JOIN trees t ON t.id = p.tree_id
       WHERE t.orchard_id = $1`,
      [req.params.id],
    );
    const rows = await query('DELETE FROM orchards WHERE id = $1 AND owner_id = $2 RETURNING id', [
      req.params.id,
      req.user!.id,
    ]);
    if (rows.length === 0) throw new ApiError(404, 'orchard_not_found', 'Orchard not found');
    const fs = await import('node:fs');
    const fsp = fs.promises;
    for (const p of photoRows) {
      await fsp.rm(p.file_path, { force: true }).catch(() => undefined);
      if (p.thumb_path) await fsp.rm(p.thumb_path, { force: true }).catch(() => undefined);
    }
    res.json({ ok: true });
  }),
);
