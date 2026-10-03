import type { PruningLevel } from '../types';

/**
 * Yield & pruning logic for the harvest survey cycle.
 * Fruit count estimates come from the surveyor counting fruit on the tree
 * (or on 2-3 representative scaffold branches extrapolated per tree).
 */

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const DEFAULT_FRUIT_WEIGHT_G = 150; // typical Royal Delicious apple

export function estimateYieldKg(
  fruitCountEst: number | null | undefined,
  avgFruitWeightG: number | null | undefined,
): number | null {
  if (fruitCountEst == null || fruitCountEst <= 0) return null;
  const weightG = avgFruitWeightG ?? DEFAULT_FRUIT_WEIGHT_G;
  const kg = (fruitCountEst * clamp(weightG, 20, 800)) / 1000;
  return round1(clamp(kg, 0, 999));
}

export interface PruningInputs {
  canopyDensity?: number | null; // 0-100 foliage fullness
  bareWoodRatio?: number | null; // 0-100 share of dead/bare wood
  waterSprouts?: number | null; // vigorous upright shoots count
  healthScore?: number | null; // 0-100 if known
}

export interface PruningVerdict {
  level: PruningLevel;
  reason: string;
}

export function pruningVerdict(inputs: PruningInputs): PruningVerdict {
  const density = inputs.canopyDensity ?? null;
  const bare = inputs.bareWoodRatio ?? null;
  const sprouts = inputs.waterSprouts ?? null;
  const health = inputs.healthScore ?? null;

  if (bare != null && bare >= 45) {
    return { level: 'renewal', reason: `Severe dead wood (${bare}%): cut back to healthy wood over 2-3 seasons, stimulate renewal growth.` };
  }
  if (density != null && density <= 30) {
    return { level: 'renewal', reason: `Very sparse canopy (${density}%): the tree needs rejuvenation cuts and canopy rebuilding.` };
  }
  if (bare != null && bare >= 30) {
    return { level: 'heavy', reason: `High bare-wood share (${bare}%): remove deadwood and thin crowded branches to restore balance.` };
  }
  if (density != null && density <= 45) {
    return { level: 'heavy', reason: `Thin canopy (${density}%): open the tree to light with corrective thinning cuts.` };
  }
  if (bare != null && bare >= 18) {
    return { level: 'moderate', reason: `Moderate dead wood (${bare}%): regular sanitary + thinning prune this winter.` };
  }
  if (sprouts != null && sprouts >= 15) {
    return { level: 'moderate', reason: `${sprouts} water sprouts: remove most upright shoots, retain a few for scaffold renewal.` };
  }
  if (sprouts != null && sprouts >= 6) {
    return { level: 'light', reason: `${sprouts} water sprouts: rub off unwanted uprights; light maintenance prune.` };
  }
  if (density != null && density <= 60) {
    return { level: 'light', reason: `Canopy slightly open (${density}%): light thinning to keep light penetration.` };
  }
  if (health != null && health <= 45) {
    return { level: 'moderate', reason: 'Weak tree health: prune lightly to reduce crop load and restore vigour.' };
  }
  return { level: 'none', reason: 'Canopy balanced - no special pruning indicated beyond routine maintenance.' };
}

export interface SurveyEntryLike {
  tree_id: string;
  tree_code?: string;
  variety?: string | null;
  estimated_yield_kg: number | null;
  canopy_density: number | null;
  computed_pruning: string | null;
}

export interface SurveySummary {
  surveyedCount: number;
  completionPct: number;
  avgYieldKg: number | null;
  maxTreeKg: number | null;
  projectedOrchardKg: number | null;
  avgCanopyDensity: number | null;
  pruningCounts: Record<PruningLevel | 'unknown', number>;
  priorities: {
    treeId: string;
    code?: string;
    variety?: string | null;
    level: PruningLevel;
    yieldKg: number | null;
    canopyDensity: number | null;
  }[];
}

const PRUNE_ORDER: PruningLevel[] = ['renewal', 'heavy', 'moderate', 'light'];

export function surveySummary(entries: SurveyEntryLike[], totalActiveTrees: number): SurveySummary {
  const n = entries.length;
  const yields = entries.map((e) => e.estimated_yield_kg).filter((y): y is number => y != null && y > 0);
  const densities = entries.map((e) => e.canopy_density).filter((d): d is number => d != null);

  const avgYield = yields.length > 0 ? round1(yields.reduce((a, b) => a + b, 0) / yields.length) : null;
  const projected =
    avgYield != null && totalActiveTrees > 0 ? Math.round(avgYield * totalActiveTrees) : null;

  const pruningCounts: Record<string, number> = { none: 0, light: 0, moderate: 0, heavy: 0, renewal: 0, unknown: 0 };
  for (const e of entries) {
    const key = (e.computed_pruning ?? 'unknown') as string;
    pruningCounts[key] = (pruningCounts[key] ?? 0) + 1;
  }

  const priorities = entries
    .filter((e) => e.computed_pruning && e.computed_pruning !== 'none')
    .map((e) => ({
      entry: e,
      rank: PRUNE_ORDER.indexOf(e.computed_pruning as PruningLevel),
      density: e.canopy_density ?? 100,
    }))
    .sort((a, b) => (a.rank - b.rank) || (a.density - b.density))
    .slice(0, 25)
    .map(({ entry }) => ({
      treeId: entry.tree_id,
      code: entry.tree_code,
      variety: entry.variety,
      level: entry.computed_pruning as PruningLevel,
      yieldKg: entry.estimated_yield_kg,
      canopyDensity: entry.canopy_density,
    }));

  return {
    surveyedCount: n,
    completionPct: totalActiveTrees > 0 ? Math.round((n / totalActiveTrees) * 100) : 0,
    avgYieldKg: avgYield,
    maxTreeKg: yields.length > 0 ? Math.max(...yields) : null,
    projectedOrchardKg: projected,
    avgCanopyDensity: densities.length > 0 ? Math.round(densities.reduce((a, b) => a + b, 0) / densities.length) : null,
    pruningCounts: pruningCounts as SurveySummary['pruningCounts'],
    priorities,
  };
}
