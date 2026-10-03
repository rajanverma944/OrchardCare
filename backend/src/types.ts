import type { Request } from 'express';

export type HealthGrade = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
export type PruningLevel = 'none' | 'light' | 'moderate' | 'heavy' | 'renewal';
export type PhotoDirection =
  | 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
  | 'CLOSEUP' | 'CANOPY' | 'TRUNK' | 'OTHER';
export type SurveyType = 'harvest' | 'pruning';
export type SprayStatus = 'pending' | 'done' | 'skipped';
export type ObservationSource = 'manual' | 'photo' | 'survey';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface PhotoAnalysis {
  ratios: {
    green: number;
    yellow: number;
    brown: number;
    white: number;
    sky: number;
    other: number;
  };
  scores: {
    leafStrength: number;   // 0-100
    canopyDensity: number;  // 0-100
    scabRisk: number;       // 0-100
    mildewRisk: number;     // 0-100
    chlorosisRisk: number;  // 0-100
  };
  flags: string[];
  analyzedAt: string;
}

export interface TreePhotoInsight {
  leafStrengthScore: number;
  canopyDensity: number;
  scabRisk: number;
  mildewRisk: number;
  chlorosisRisk: number;
  flags: string[];
  suggestedDiseases: { code: string; confidence: number }[];
  healthGradeHint: HealthGrade | null;
  directionsCovered: string[];
  photoCount: number;
  confidence: 'full' | 'partial' | 'low';
  note: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
