import { Router } from 'express';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/error';
import { getOwnedOrchard } from '../repo';
import {
  deriveStatus,
  ensureSprayPlan,
  STAGE_DEFS,
  type StageDef,
} from '../services/sprayCalendar';
import { sprayTaskUpdateSchema } from '../validation';

export const sprayRouter = Router();
sprayRouter.use(requireAuth);

function localTodayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

sprayRouter.get(
  '/orchards/:orchardId/plan',
  asyncHandler(async (req, res) => {
    const orchard = await getOwnedOrchard(req.params.orchardId, req.user!.id);
    const season = req.query.season
      ? (() => {
          const y = parseInt(String(req.query.season), 10);
          if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new ApiError(400, 'bad_season', 'season must be a year like 2026');
          return y;
        })()
      : new Date().getFullYear();

    await ensureSprayPlan(orchard.id, season, orchard.elevation_m);

    const tasks = await query<{
      id: string; stage_key: string; planned_start: string; planned_end: string;
      status: 'pending' | 'done' | 'skipped'; product_used: string | null;
      completed_at: Date | null; notes: string | null;
    }>(
      `SELECT id, stage_key, planned_start::text, planned_end::text, status, product_used, completed_at, notes
       FROM spray_tasks WHERE orchard_id = $1 AND season = $2
       ORDER BY planned_start`,
      [orchard.id, season],
    );
    const byKey = new Map(tasks.map((t) => [t.stage_key, t]));
    const today = localTodayISO();

    const stages = STAGE_DEFS.map((def: StageDef) => {
      const task = byKey.get(def.key);
      if (!task) return null;
      return {
        taskId: task.id,
        key: def.key,
        kind: def.kind,
        name: def.name,
        targets: def.targets,
        products: def.products,
        phiDays: def.phiDays,
        beeSafety: def.beeSafety,
        advice: def.advice,
        plannedStart: task.planned_start,
        plannedEnd: task.planned_end,
        status: deriveStatus(task.status, task.planned_start, task.planned_end, today),
        taskStatus: task.status,
        productUsed: task.product_used,
        completedAt: task.completed_at,
        notes: task.notes,
      };
    }).filter((s): s is NonNullable<typeof s> => s != null);

    res.json({ season, orchardName: orchard.name, elevationShiftNote: orchard.elevation_m, stages });
  }),
);

sprayRouter.put(
  '/tasks/:taskId',
  asyncHandler(async (req, res) => {
    const body = sprayTaskUpdateSchema.parse(req.body);
    const rows = await query<{ orchard_id: string }>(
      'SELECT orchard_id FROM spray_tasks WHERE id = $1',
      [req.params.taskId],
    );
    if (rows.length === 0) throw new ApiError(404, 'task_not_found', 'Spray task not found');
    await getOwnedOrchard(rows[0].orchard_id, req.user!.id);

    const updated = await query(
      `UPDATE spray_tasks SET status = $2, product_used = $3, notes = $4,
         completed_at = CASE WHEN $2 = 'done' THEN COALESCE($5::timestamptz, now()) ELSE completed_at END
       WHERE id = $1 RETURNING id`,
      [req.params.taskId, body.status, body.productUsed ?? null, body.notes ?? null, body.completedAt ?? null],
    );
    res.json({ ok: updated.length > 0 });
  }),
);
