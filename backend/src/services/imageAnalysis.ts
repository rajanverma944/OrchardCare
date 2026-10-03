import sharp from 'sharp';
import type { HealthGrade, PhotoAnalysis, PhotoDirection, TreePhotoInsight } from '../types';

/**
 * Heuristic canopy photo analysis (beta).
 *
 * Classifies pixels into colour families (healthy green, chlorotic yellow,
 * necrotic brown, whitish bloom, sky, other) and derives 0-100 scores:
 *   - leafStrength: robust green canopy with little yellowing/browning
 *   - canopyDensity: share of frame holding foliage (sky excluded)
 *   - scabRisk: brown lesion-like pixel share (apple scab produces olive-brown
 *     spots on leaves/fruit)
 *   - mildewRisk: whitish powdery bloom in the lower part of the frame
 *     (powdery mildew white fungal mat; sky/overcast appears at the top and is
 *     excluded from this metric)
 *   - chlorosisRisk: yellowing share (nutrient stress / leafhopper burn)
 *
 * These are decision-support estimates, not a laboratory diagnosis. Always
 * confirm suspected disease with your horticulture officer.
 */

const MAX_ANALYSIS_EDGE = 512;

interface PixelClasses {
  sky: number;
  green: number;
  yellow: number;
  brown: number;
  whiteLow: number;
  other: number;
  total: number;
  nonSky: number;
}

function classifyPixels(rgb: Uint8Array, width: number, height: number): PixelClasses {
  const c: PixelClasses = { sky: 0, green: 0, yellow: 0, brown: 0, whiteLow: 0, other: 0, total: width * height, nonSky: 0 };

  for (let y = 0; y < height; y++) {
    const inLowerTwoThirds = y > height / 3;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const r = rgb[i];
      const g = rgb[i + 1];
      const b = rgb[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      // Sky / overcast backdrop (typically upper frame, blue or bright grey).
      const isBlueSky = b > r + 25 && b > g + 10 && b > 120;
      const isBrightSky = max > 200 && min > 185 && y < height * 0.3;
      if (isBlueSky || isBrightSky) {
        c.sky++;
        continue;
      }
      c.nonSky++;

      // Healthy green foliage: green dominates both other channels.
      if (g >= r + 12 && g >= b + 12) {
        c.green++;
        continue;
      }
      // Chlorotic yellow: r≈g clearly above b.
      if (r > 130 && g > 105 && r >= b + 25 && g >= b + 15 && Math.abs(r - g) < 70) {
        c.yellow++;
        continue;
      }
      // Brown / necrotic lesion tones: red dominates, dull.
      if (r > 55 && r < 195 && r > g + 15 && g >= b - 10 && r - b > 22 && max < 210) {
        c.brown++;
        continue;
      }
      // Whitish bloom in the lower frame -> powdery mildew candidate.
      if (inLowerTwoThirds && min > 165 && max - min < 30) {
        c.whiteLow++;
        continue;
      }
      c.other++;
    }
  }
  return c;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pct = (n: number, d: number) => (d <= 0 ? 0 : n / d);

export async function analyzePhotoBuffer(buffer: Buffer): Promise<PhotoAnalysis> {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .rotate() // respect EXIF orientation
    .removeAlpha()
    .toColourspace('srgb')
    .resize({ width: MAX_ANALYSIS_EDGE, height: MAX_ANALYSIS_EDGE, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const c = classifyPixels(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), info.width, info.height);

  const green = pct(c.green, c.nonSky);
  const yellow = pct(c.yellow, c.nonSky);
  const brown = pct(c.brown, c.nonSky);
  const white = pct(c.whiteLow, c.nonSky);
  const other = pct(c.other, c.nonSky);

  const leafStrength = Math.round(clamp((green - 0.45 * yellow - 1.2 * brown) / 0.55, 0, 1) * 100);
  const canopyDensity = Math.round(clamp(green + yellow, 0, 1) * 100);
  const scabRisk = Math.round(clamp(brown / 0.05, 0, 1) * 100);
  const mildewRisk = Math.round(clamp(white / 0.1, 0, 1) * 100);
  const chlorosisRisk = Math.round(clamp(yellow / 0.15, 0, 1) * 100);

  const flags: string[] = [];
  if (scabRisk >= 35) flags.push('scab-symptoms-likely');
  if (mildewRisk >= 30 && canopyDensity > 20) flags.push('powdery-mildew-possible');
  if (chlorosisRisk >= 40) flags.push('chlorosis-likely');
  if (leafStrength < 40) flags.push('weak-canopy');

  return {
    ratios: { green, yellow, brown, white, sky: pct(c.sky, c.total), other },
    scores: { leafStrength, canopyDensity, scabRisk, mildewRisk, chlorosisRisk },
    flags,
    analyzedAt: new Date().toISOString(),
  };
}

const DIRECTIONS: readonly PhotoDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function gradeFromScores(leafStrength: number, scabRisk: number, mildewRisk: number): HealthGrade {
  let grade: HealthGrade =
    leafStrength >= 85 ? 'excellent'
    : leafStrength >= 70 ? 'good'
    : leafStrength >= 50 ? 'fair'
    : leafStrength >= 30 ? 'poor'
    : 'critical';
  if ((scabRisk >= 60 || mildewRisk >= 60) && grade !== 'critical') {
    const order: HealthGrade[] = ['excellent', 'good', 'fair', 'poor', 'critical'];
    grade = order[Math.min(order.indexOf(grade) + 1, order.length - 1)];
  }
  return grade;
}

/** Merge the analyses of a tree's photo set into a tree-level insight. */
export function aggregateAnalyses(
  photos: { direction: string; analysis: PhotoAnalysis }[],
): TreePhotoInsight | null {
  if (photos.length === 0) return null;

  const avg = (pick: (a: PhotoAnalysis) => number) =>
    photos.reduce((sum, p) => sum + pick(p.analysis), 0) / photos.length;

  const leafStrength = Math.round(avg((a) => a.scores.leafStrength));
  const canopyDensity = Math.round(avg((a) => a.scores.canopyDensity));
  const scabRisk = Math.round(avg((a) => a.scores.scabRisk));
  const mildewRisk = Math.round(avg((a) => a.scores.mildewRisk));
  const chlorosisRisk = Math.round(avg((a) => a.scores.chlorosisRisk));

  const flagCounts = new Map<string, number>();
  for (const p of photos) {
    for (const f of p.analysis.flags) flagCounts.set(f, (flagCounts.get(f) ?? 0) + 1);
  }
  const half = photos.length / 2;
  const flags = [...flagCounts.entries()].filter(([, n]) => n > half || n === photos.length).map(([f]) => f);

  const directionsCovered = [...new Set(photos.map((p) => p.direction))];
  const ringCount = directionsCovered.filter((d) => (DIRECTIONS as readonly string[]).includes(d)).length;
  const confidence: TreePhotoInsight['confidence'] =
    ringCount >= 8 ? 'full' : ringCount >= 4 ? 'partial' : 'low';

  const suggestedDiseases: { code: string; confidence: number }[] = [];
  if (scabRisk >= 35) suggestedDiseases.push({ code: 'apple-scab', confidence: Math.min(1, scabRisk / 100) });
  if (mildewRisk >= 30) suggestedDiseases.push({ code: 'powdery-mildew', confidence: Math.min(1, mildewRisk / 100) });
  if (chlorosisRisk >= 40) suggestedDiseases.push({ code: 'nutrient-deficiency', confidence: Math.min(1, chlorosisRisk / 100) });
  suggestedDiseases.sort((a, b) => b.confidence - a.confidence);

  return {
    leafStrengthScore: leafStrength,
    canopyDensity,
    scabRisk,
    mildewRisk,
    chlorosisRisk,
    flags,
    suggestedDiseases,
    healthGradeHint: gradeFromScores(leafStrength, scabRisk, mildewRisk),
    directionsCovered,
    photoCount: photos.length,
    confidence,
    note:
      'Heuristic estimate from photo colours (beta). Confirm suspected disease with your horticulture officer before spraying.',
  };
}
