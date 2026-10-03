import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FRUIT_WEIGHT_G,
  estimateYieldKg,
  pruningVerdict,
  surveySummary,
} from '../src/services/yieldService';

describe('estimateYieldKg', () => {
  it('computes kg from fruit count and weight', () => {
    expect(estimateYieldKg(100, 150)).toBe(15);
    expect(estimateYieldKg(333, 140)).toBe(46.6);
  });

  it('uses the default Delicious weight when not given', () => {
    expect(estimateYieldKg(100, null)).toBe(DEFAULT_FRUIT_WEIGHT_G / 10);
  });

  it('returns null for zero/missing counts', () => {
    expect(estimateYieldKg(null, 150)).toBeNull();
    expect(estimateYieldKg(0, 150)).toBeNull();
    expect(estimateYieldKg(undefined, undefined)).toBeNull();
  });

  it('clamps absurd inputs', () => {
    expect(estimateYieldKg(50000, 700)).toBe(999);
  });
});

describe('pruningVerdict', () => {
  it('renews trees with severe bare wood', () => {
    const v = pruningVerdict({ canopyDensity: 40, bareWoodRatio: 50, waterSprouts: 2 });
    expect(v.level).toBe('renewal');
    expect(v.reason).toContain('50%');
  });

  it('renews very sparse canopies', () => {
    expect(pruningVerdict({ canopyDensity: 25, bareWoodRatio: 5 }).level).toBe('renewal');
  });

  it('orders heavy before moderate', () => {
    expect(pruningVerdict({ canopyDensity: 40, bareWoodRatio: 10 }).level).toBe('heavy');
    expect(pruningVerdict({ canopyDensity: 55, bareWoodRatio: 20 }).level).toBe('moderate');
    expect(pruningVerdict({ canopyDensity: 55, bareWoodRatio: 5, waterSprouts: 8 }).level).toBe('light');
    expect(pruningVerdict({ canopyDensity: 75, bareWoodRatio: 5, waterSprouts: 2 }).level).toBe('none');
  });

  it('respects weak health with no other signal', () => {
    expect(pruningVerdict({ healthScore: 30 }).level).toBe('moderate');
  });

  it('defaults to none with no inputs', () => {
    expect(pruningVerdict({}).level).toBe('none');
  });
});

describe('surveySummary', () => {
  const entries = [
    { tree_id: 't1', estimated_yield_kg: 40, canopy_density: 70, computed_pruning: 'none' },
    { tree_id: 't2', estimated_yield_kg: 20, canopy_density: 30, computed_pruning: 'renewal' },
    { tree_id: 't3', estimated_yield_kg: 60, canopy_density: 55, computed_pruning: 'moderate' },
    { tree_id: 't4', estimated_yield_kg: null, canopy_density: 80, computed_pruning: 'heavy' },
  ];

  it('computes averages and projection', () => {
    const s = surveySummary(entries, 10);
    expect(s.surveyedCount).toBe(4);
    expect(s.avgYieldKg).toBe(40);
    expect(s.maxTreeKg).toBe(60);
    expect(s.projectedOrchardKg).toBe(400);
    expect(s.completionPct).toBe(40);
    expect(s.avgCanopyDensity).toBe(59);
  });

  it('prioritises renewal first, then heavy, then moderate', () => {
    const s = surveySummary(entries, 10);
    expect(s.priorities.map((p) => p.level)).toEqual(['renewal', 'heavy', 'moderate']);
    expect(s.priorities[0].treeId).toBe('t2');
  });

  it('counts pruning levels', () => {
    const s = surveySummary(entries, 10);
    expect(s.pruningCounts.none).toBe(1);
    expect(s.pruningCounts.renewal).toBe(1);
    expect(s.pruningCounts.moderate).toBe(1);
    expect(s.pruningCounts.heavy).toBe(1);
  });

  it('handles empty surveys', () => {
    const s = surveySummary([], 10);
    expect(s.avgYieldKg).toBeNull();
    expect(s.projectedOrchardKg).toBeNull();
    expect(s.completionPct).toBe(0);
  });
});
