import type { DbClient } from '../db';
import { query } from '../db';

/**
 * Spray & care calendar for apple orchards in the Shimla hills (Himachal
 * Pradesh). Dates are calibrated for the mid-elevation belt (~2000 m:
 * Kotgarh, Theog, Mashobra, Jubbal) and shifted by elevation.
 *
 * Rates are given per 200 L knapsack - the standard HP Horticulture
 * Department convention. ALWAYS read the product label and confirm with your
 * local Circle Horticulture Development Officer before spraying.
 */

export interface SprayProduct {
  name: string;
  rate: string;
  target: string;
  organic?: boolean;
}

export interface StageDef {
  key: string;
  kind: 'spray' | 'care';
  name: string;
  /** Base window at ~2000 m reference elevation (month is 1-based). */
  start: { month: number; day: number };
  end: { month: number; day: number };
  targets: string[];
  products: SprayProduct[];
  phiDays: number | null;
  beeSafety: string | null;
  advice: string;
}

export const STAGE_DEFS: StageDef[] = [
  {
    key: 'dormant-oil',
    kind: 'spray',
    name: 'Dormant oil spray',
    start: { month: 1, day: 20 },
    end: { month: 2, day: 10 },
    targets: ['Woolly aphid', 'San José scale', 'Mite eggs'],
    products: [
      { name: 'Horticultural mineral oil 99% EC', rate: '2% (4 L per 200 L water)', target: 'sucking pests & eggs', organic: true },
    ],
    phiDays: null,
    beeSafety: 'Safe for bees when applied before bloom; avoid drift onto flowering crops nearby.',
    advice:
      'Apply on a clear, dry morning when the bark is not wet and temperature is above 4°C. Thoroughly drench stems, branches and branch crotches - this single spray controls overwintering woolly aphid and scale colonies and reduces early mite build-up without harsher insecticides.',
  },
  {
    key: 'pink-bud',
    kind: 'spray',
    name: 'Pink bud spray',
    start: { month: 3, day: 18 },
    end: { month: 4, day: 5 },
    targets: ['Apple scab (primary)', 'Blossom thrips'],
    products: [
      { name: 'Mancozeb 75 WP', rate: '0.25% (500 g per 200 L)', target: 'apple scab' },
      { name: 'Thiamethoxam 25 WG (only if thrips seen)', rate: '0.025% (40 g per 200 L)', target: 'blossom thrips' },
      { name: 'Sulphur 80 WP (organic option)', rate: '0.25% (500 g per 200 L)', target: 'scab + mildew', organic: true },
    ],
    phiDays: null,
    beeSafety: 'CRITICAL: do not spray insecticides once flowers open. If thrips force a spray, apply after 6 pm and inform beekeepers. Never spray mancozeb on open bloom in bee-active orchards.',
    advice:
      'The most important scab spray of the season: primary scab ascospores are released from bud-break to petal fall. Spray when buds show pink - if rain interrupts, re-apply once the foliage dries. Keep beehives (2 boxes/ha) ready at 10% bloom for pollination.',
  },
  {
    key: 'petal-fall',
    kind: 'spray',
    name: 'Petal fall spray',
    start: { month: 4, day: 25 },
    end: { month: 5, day: 10 },
    targets: ['Apple scab', 'Powdery mildew', 'Codling moth (1st gen)', 'Mites'],
    products: [
      { name: 'Carbendazim 50 WP', rate: '0.05% (100 g per 200 L)', target: 'scab' },
      { name: 'Sulphur 80 WP', rate: '0.25% (500 g per 200 L)', target: 'powdery mildew + mites', organic: true },
      { name: 'Chlorantraniliprole 18.5 SC (if trap catch >5 moths/week)', rate: '0.3 ml/L', target: 'codling moth' },
    ],
    phiDays: 14,
    beeSafety: 'Apply after 90% petal fall when bees are no longer foraging in the block.',
    advice:
      'Time it to petal fall, not the calendar. Hang pheromone traps (5/ha) now and base codling moth sprays on trap counts, not routine. Alternate fungicide groups (mancozeb → carbendazim) to delay resistance.',
  },
  {
    key: 'first-cover',
    kind: 'spray',
    name: 'First cover spray',
    start: { month: 5, day: 18 },
    end: { month: 6, day: 3 },
    targets: ['Apple scab', 'Woolly aphid', 'Fruit drop'],
    products: [
      { name: 'Captan 50 WP', rate: '0.25% (500 g per 200 L)', target: 'scab + fruit rots' },
      { name: 'Imidacloprid 17.8 SL (only if woolly aphid colonies seen)', rate: '0.3 ml/L', target: 'woolly aphid' },
      { name: 'NAA 10 ppm (one-time, 10-14 days after petal fall)', rate: 'per label', target: 'pre-harvest drop control' },
    ],
    phiDays: 21,
    beeSafety: 'Post-bloom: safe for bees if applied in the evening.',
    advice:
      'Also complete fruit thinning now - keep one fruit per cluster, 15 cm apart, preferring the king fruit. Over-cropped trees bear biennially and have small fruit. Band trunks with corrugated cardboard for codling moth larvae collection.',
  },
  {
    key: 'second-cover',
    kind: 'spray',
    name: 'Second cover spray',
    start: { month: 6, day: 8 },
    end: { month: 6, day: 22 },
    targets: ['Apple scab', 'Alternaria blotch', 'Spider mites'],
    products: [
      { name: 'Mancozeb 75 WP', rate: '0.3% (600 g per 200 L)', target: 'scab + alternaria' },
      { name: 'Hexaconazole 5 EC (if scab lesions seen)', rate: '0.05% (100 ml per 200 L)', target: 'scab (systemic)' },
      { name: 'Propargite 57 EC (only if mite damage on >10% leaves)', rate: '0.1% (200 ml per 200 L)', target: 'spider mites' },
    ],
    phiDays: 21,
    beeSafety: 'Evening application recommended.',
    advice:
      'June is fruit-cell-division time - irrigation stress now permanently reduces final fruit size. Ensure basins are mulched. Scout 10 trees per block weekly: spray miticides only when thresholds are crossed.',
  },
  {
    key: 'pre-monsoon',
    kind: 'spray',
    name: 'Pre-monsoon spray',
    start: { month: 6, day: 28 },
    end: { month: 7, day: 12 },
    targets: ['Codling moth (2nd gen)', 'Apple scab', 'Alternaria blotch'],
    products: [
      { name: 'Ziram 80 WP', rate: '0.3% (600 g per 200 L)', target: 'scab + alternaria' },
      { name: 'Deltamethrin 2.8 EC (on trap count)', rate: '0.5 ml/L', target: 'codling moth' },
    ],
    phiDays: 21,
    beeSafety: 'Evening application recommended.',
    advice:
      'Repair and re-tension anti-hail nets before the monsoon hail corridor peaks. Clean drainage channels; prop heavy scaffold limbs to avoid limb breakage under fruit load and wind.',
  },
  {
    key: 'monsoon-cover',
    kind: 'spray',
    name: 'Monsoon cover spray',
    start: { month: 7, day: 18 },
    end: { month: 8, day: 2 },
    targets: ['Apple scab', 'Alternaria blotch', 'Marssonina leaf fall'],
    products: [
      { name: 'Captan 50 WP', rate: '0.3% (600 g per 200 L)', target: 'scab, leaf spots' },
      { name: 'Urea 5% (only for late varieties, post leaf-infection)', rate: 'per label', target: 'leaf fall management' },
    ],
    phiDays: 21,
    beeSafety: 'Evening application recommended.',
    advice:
      'Wet foliage for >12 h = infection period. Keep a 12-15 day cycle through the monsoon for late varieties; obey the pre-harvest interval as harvest approaches. Early varieties need no further pesticide after early July - only calcium.',
  },
  {
    key: 'calcium-spray',
    kind: 'spray',
    name: 'Calcium chloride for bitter pit',
    start: { month: 7, day: 25 },
    end: { month: 8, day: 20 },
    targets: ['Bitter pit', 'Fruit firmness', 'Storage quality'],
    products: [
      { name: 'Calcium chloride (food grade) 0.6%', rate: '1.2 kg per 200 L, 2-3 sprays 10 days apart', target: 'bitter pit control', organic: true },
    ],
    phiDays: 0,
    beeSafety: 'Bee-safe.',
    advice:
      'Essential for Royal Delicious / Red Delicious blocks with bitter pit history or light crops. Never mix calcium chloride with other pesticides; spray in the evening to avoid leaf burn; harvest-ready fruit tolerates it well.',
  },
  {
    key: 'harvest-window',
    kind: 'care',
    name: 'Hararvest window',
    start: { month: 8, day: 5 },
    end: { month: 9, day: 20 },
    targets: ['Maturity testing', 'Grading', 'Pre-cooling'],
    products: [],
    phiDays: null,
    beeSafety: null,
    advice:
      'NO pesticide sprays in this window. Judge maturity by: 140-150 days from full bloom (Royal Delicious), starch-iodine test reading 2-3, flesh firmness 15-17 lb pressure. Pick dry fruit in the cool hours, pre-cool within 24 h, grade in the shade - field heat is the biggest quality thief.',
  },
  {
    key: 'post-harvest-urea',
    kind: 'spray',
    name: 'Post-harvest urea spray',
    start: { month: 10, day: 1 },
    end: { month: 10, day: 20 },
    targets: ['Scab inoculum reduction', 'Early leaf fall'],
    products: [
      { name: 'Urea 5% foliar', rate: '10 kg per 200 L water', target: 'leaf litter decomposition + scab sanitation', organic: true },
    ],
    phiDays: null,
    beeSafety: 'Bee-safe.',
    advice:
      'Spray the trees AND the fallen leaf litter within two weeks of harvest. Urea speeds leaf decomposition so scab ascospore counts next spring drop sharply. Rake out mummified fruit and bury or compost them away from the block.',
  },
  {
    key: 'autumn-sanitation',
    kind: 'care',
    name: 'Autumn sanitation & winter prep',
    start: { month: 11, day: 1 },
    end: { month: 11, day: 25 },
    targets: ['Sanitation', 'Trunk protection', 'Net repair'],
    products: [
      { name: 'Bordopaste (lime : copper sulphate : linseed oil)', rate: 'paint trunks and basins', target: 'collar rot & bark borers', organic: true },
    ],
    phiDays: null,
    beeSafety: null,
    advice:
      'Remove water sprouts and dead wood, scrape loose bark where woolly aphid hides, paint lower trunks. Check and repair anti-hail nets and tree guards before snow. Clean your spray tank, nozzles and filters for winter.',
  },
  {
    key: 'winter-pruning',
    kind: 'care',
    name: 'Winter pruning window',
    start: { month: 12, day: 10 },
    end: { month: 2, day: 20 },
    targets: ['Pruning', 'Training', 'Canopy renewal'],
    products: [
      { name: 'Pruning wound paint', rate: 'on cuts > 2 cm', target: 'canker / rot protection', organic: true },
    ],
    phiDays: null,
    beeSafety: null,
    advice:
      'Prune on dry, sunny days. Remove dead, diseased, crossing and inward wood first; then thin crowded spurs. Mature Delicious trees: keep the modified-leader shape with 45° scaffold angles. Sterilise tools with 70% alcohol between trees if canker is present. Use the app\'s Pruning Survey results to prioritise blocks needing renewal cuts.',
  },
];

/** Elevation adjustment: upper orchards (Kotkhai, Chopal, Thanedar-high) bud out later. */
export function elevationShiftDays(elevationM: number | null | undefined): number {
  const elev = elevationM ?? 2000;
  if (elev >= 2400) return 12;
  if (elev >= 2200) return 7;
  if (elev >= 1800) return 0;
  return -8;
}

function dateInSeason(season: number, month: number, day: number, shiftDays: number): Date {
  // Months Jan..Jun belong to `season`; Jul onwards also `season` (single calendar year).
  const d = new Date(Date.UTC(season, month - 1, day, 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + shiftDays);
  return d;
}

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

export interface SeasonWindow {
  stage: StageDef;
  plannedStart: string;
  plannedEnd: string;
}

export function planForSeason(season: number, elevationM: number | null | undefined): SeasonWindow[] {
  const shift = elevationShiftDays(elevationM);
  return STAGE_DEFS.map((stage) => ({
    stage,
    plannedStart: toISODate(dateInSeason(season, stage.start.month, stage.start.day, shift)),
    plannedEnd: toISODate(dateInSeason(season, stage.end.month, stage.end.day, shift)),
  }));
}

export type DerivedStatus = 'done' | 'skipped' | 'overdue' | 'in-window' | 'due-soon' | 'upcoming';

export function deriveStatus(
  status: 'pending' | 'done' | 'skipped',
  plannedStart: string,
  plannedEnd: string,
  todayISO: string,
): DerivedStatus {
  if (status === 'done') return 'done';
  if (status === 'skipped') return 'skipped';
  const start = Date.parse(`${plannedStart}T00:00:00Z`);
  const end = Date.parse(`${plannedEnd}T23:59:59Z`);
  const today = Date.parse(`${todayISO}T12:00:00Z`);
  if (today < start) {
    return start - today <= 7 * 86_400_000 ? 'due-soon' : 'upcoming';
  }
  if (today <= end) return 'in-window';
  return 'overdue';
}

/** Idempotently materialise the spray plan for an orchard+season. */
export async function ensureSprayPlan(
  orchardId: string,
  season: number,
  elevationM: number | null | undefined,
  client?: DbClient,
): Promise<void> {
  const existing = await query<{ stage_key: string }>(
    'SELECT stage_key FROM spray_tasks WHERE orchard_id = $1 AND season = $2',
    [orchardId, season],
    client,
  );
  const have = new Set(existing.map((r) => r.stage_key));
  const missing = planForSeason(season, elevationM).filter((w) => !have.has(w.stage.key));
  if (missing.length === 0) return;
  await query(
    `INSERT INTO spray_tasks (orchard_id, season, stage_key, planned_start, planned_end)
     SELECT * FROM unnest($1::uuid[], $2::int[], $3::text[], $4::date[], $5::date[])
     ON CONFLICT (orchard_id, season, stage_key) DO NOTHING`,
    [
      missing.map(() => orchardId),
      missing.map(() => season),
      missing.map((w) => w.stage.key),
      missing.map((w) => w.plannedStart),
      missing.map((w) => w.plannedEnd),
    ],
    client,
  );
}
