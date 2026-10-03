import type { DbClient } from './db';
import { query } from './db';
import { ApiError } from './middleware/error';

export interface OrchardRow {
  id: string;
  owner_id: string;
  name: string;
  village: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation_m: number | null;
  area_hectares: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TreeRow {
  id: string;
  orchard_id: string;
  code: string;
  variety: string | null;
  rootstock: string | null;
  planted_year: number | null;
  block: string | null;
  latitude: number;
  longitude: number;
  gps_accuracy_m: number | null;
  height_m: string | null;
  trunk_girth_cm: string | null;
  canopy_diameter_m: string | null;
  health_grade: string | null;
  health_score: number | null;
  leaf_strength_score: number | null;
  disease_code: string | null;
  disease_severity: number | null;
  disease_notes: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_assessed_at: Date | null;
}

export async function getOwnedOrchard(
  orchardId: string,
  userId: string,
  client?: DbClient,
): Promise<OrchardRow> {
  const rows = await query<OrchardRow>(
    'SELECT * FROM orchards WHERE id = $1 AND owner_id = $2',
    [orchardId, userId],
    client,
  );
  if (rows.length === 0) throw new ApiError(404, 'orchard_not_found', 'Orchard not found');
  return rows[0];
}

export async function getOwnedTree(
  treeId: string,
  userId: string,
  client?: DbClient,
): Promise<{ tree: TreeRow; orchard: OrchardRow }> {
  const rows = await query<TreeRow & { owner_id: string }>(
    `SELECT t.*, o.owner_id FROM trees t JOIN orchards o ON o.id = t.orchard_id
     WHERE t.id = $1`,
    [treeId],
    client,
  );
  if (rows.length === 0 || rows[0].owner_id !== userId) {
    throw new ApiError(404, 'tree_not_found', 'Tree not found');
  }
  const { owner_id: _ownerId, ...tree } = rows[0];
  const orchard = await getOwnedOrchard(tree.orchard_id, userId, client);
  return { tree, orchard };
}

export async function countActiveTrees(orchardId: string, client?: DbClient): Promise<number> {
  const rows = await query<{ n: string }>(
    'SELECT count(*)::text AS n FROM trees WHERE orchard_id = $1 AND is_active',
    [orchardId],
    client,
  );
  return parseInt(rows[0].n, 10);
}
