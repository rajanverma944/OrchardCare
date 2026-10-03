import { z } from 'zod';

export const healthGrades = ['excellent', 'good', 'fair', 'poor', 'critical'] as const;
export const pruningLevels = ['none', 'light', 'moderate', 'heavy', 'renewal'] as const;
export const photoDirections = [
  'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'CLOSEUP', 'CANOPY', 'TRUNK', 'OTHER',
] as const;

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v === '' ? undefined : v));

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200),
});

export const orchardCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  village: optionalText(120),
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  elevationM: z.number().int().min(0).max(4500).optional(),
  areaHectares: z.number().min(0).max(10000).optional(),
});

export const orchardUpdateSchema = orchardCreateSchema.partial();

export const treeCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(24)
    .regex(/^[A-Za-z0-9._\- ]+$/, 'Code may contain letters, digits, dot, dash, underscore, space'),
  variety: optionalText(60),
  rootstock: optionalText(40),
  plantedYear: z.number().int().min(1850).max(2200).optional(),
  block: optionalText(24),
  latitude,
  longitude,
  gpsAccuracyM: z.number().min(0).max(200).optional(),
  heightM: z.number().min(0).max(40).optional(),
  trunkGirthCm: z.number().min(0).max(500).optional(),
  canopyDiameterM: z.number().min(0).max(30).optional(),
  healthGrade: z.enum(healthGrades).optional(),
  healthScore: z.number().int().min(0).max(100).optional(),
  leafStrengthScore: z.number().int().min(0).max(100).optional(),
  diseaseCode: optionalText(40),
  diseaseSeverity: z.number().int().min(0).max(5).optional(),
  diseaseNotes: optionalText(1000),
  notes: optionalText(2000),
  clientTreeId: z.string().uuid().optional(),
});

export const treeUpdateSchema = treeCreateSchema
  .omit({ latitude: true, longitude: true, clientTreeId: true })
  .partial()
  .extend({ latitude: latitude.optional(), longitude: longitude.optional(), isActive: z.boolean().optional() });

export const observationCreateSchema = z.object({
  observedAt: z.string().datetime().optional(),
  heightM: z.number().min(0).max(40).optional(),
  healthScore: z.number().int().min(0).max(100).optional(),
  healthGrade: z.enum(healthGrades).optional(),
  leafStrengthScore: z.number().int().min(0).max(100).optional(),
  diseaseCode: optionalText(40),
  diseaseSeverity: z.number().int().min(0).max(5).optional(),
  notes: optionalText(2000),
  clientObsId: z.string().uuid().optional(),
});

export const surveyCreateSchema = z.object({
  type: z.enum(['harvest', 'pruning']),
  season: z.string().regex(/^\d{4}$/),
  notes: optionalText(2000),
});

export const surveyEntryCreateSchema = z.object({
  treeId: z.string().uuid(),
  clientEntryId: z.string().uuid().optional(),
  fruitCountEst: z.number().int().min(0).max(30000).optional(),
  avgFruitWeightG: z.number().int().min(20).max(800).optional(),
  canopyDensity: z.number().int().min(0).max(100).optional(),
  bareWoodRatio: z.number().int().min(0).max(100).optional(),
  waterSprouts: z.number().int().min(0).max(500).optional(),
  pruningNeeded: z.enum(pruningLevels).optional(),
  notes: optionalText(1000),
});

export const sprayTaskUpdateSchema = z.object({
  status: z.enum(['pending', 'done', 'skipped']),
  productUsed: optionalText(200),
  completedAt: z.string().datetime().optional(),
  notes: optionalText(1000),
});

export type SyncChange =
  | { op: 'tree.create'; clientId: string; orchardId: string; payload: z.infer<typeof treeCreateSchema> }
  | { op: 'tree.update'; clientId: string; payload: { treeId: string } & z.infer<typeof treeUpdateSchema> }
  | { op: 'observation.create'; clientId: string; payload: { treeId: string } & z.infer<typeof observationCreateSchema> }
  | { op: 'survey.entry.create'; clientId: string; payload: { orchardId: string; surveyId?: string } & z.infer<typeof surveyEntryCreateSchema> }
  | { op: 'spray.task.update'; clientId: string; payload: { taskId: string } & z.infer<typeof sprayTaskUpdateSchema> };

export const syncSchema = z.object({
  changes: z.array(z.object({ op: z.string(), clientId: z.string().uuid(), payload: z.unknown() })).min(1).max(100),
});
