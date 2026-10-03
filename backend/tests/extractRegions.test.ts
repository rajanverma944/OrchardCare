import { describe, expect, it } from 'vitest';
import { extractRegions } from '../src/services/imageAnalysis';

function makeMask(width: number, height: number, rects: [number, number, number, number][]): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (const [x0, y0, w, h] of rects) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) mask[y * width + x] = 1;
    }
  }
  return mask;
}

describe('extractRegions', () => {
  it('finds a single block with correct normalised bounds', () => {
    // 100x100, block at (20,30) size 10x10 = 100 px
    const mask = makeMask(100, 100, [[20, 30, 10, 10]]);
    const regions = extractRegions(mask, 100, 100, 'lesion');
    expect(regions).toHaveLength(1);
    expect(regions[0].x).toBeCloseTo(0.2);
    expect(regions[0].y).toBeCloseTo(0.3);
    expect(regions[0].w).toBeCloseTo(0.1);
    expect(regions[0].h).toBeCloseTo(0.1);
    expect(regions[0].coverage).toBe(1);
    expect(regions[0].cls).toBe('lesion');
  });

  it('merges edge-touching pixels into one region', () => {
    // two 6x6 blocks sharing an edge (x=16) on a 100x100 mask
    const mask = makeMask(100, 100, [[10, 10, 6, 6], [16, 10, 6, 6]]);
    const regions = extractRegions(mask, 100, 100, 'lesion');
    expect(regions).toHaveLength(1);
    expect(regions[0].w).toBeCloseTo(12 / 100);
    expect(regions[0].h).toBeCloseTo(6 / 100);
  });

  it('drops components smaller than the minimum size', () => {
    // 2x2 px on a 100x100 mask (0.04% < 0.2% minimum)
    const mask = makeMask(100, 100, [[5, 5, 2, 2]]);
    expect(extractRegions(mask, 100, 100, 'bloom')).toHaveLength(0);
  });

  it('sorts regions largest-first and caps the count', () => {
    const rects: [number, number, number, number][] = [];
    for (let i = 0; i < 20; i++) {
      rects.push([i * 40, 10, 30 - (i % 3) * 5, 30]);
    }
    const mask = makeMask(1000, 100, rects);
    const regions = extractRegions(mask, 1000, 100, 'lesion');
    expect(regions.length).toBeLessThanOrEqual(12);
    for (let i = 1; i < regions.length; i++) {
      expect(regions[i - 1].coverage).toBeGreaterThanOrEqual(regions[i].coverage);
    }
  });

  it('returns empty for an empty mask', () => {
    expect(extractRegions(new Uint8Array(100 * 100), 100, 100, 'lesion')).toHaveLength(0);
  });
});
