import { Router } from 'express';
import { ADVICE_ARTICLES, DISEASES, VARIETIES } from '../services/adviceData';
import { STAGE_DEFS, elevationShiftDays } from '../services/sprayCalendar';

export const adviceRouter = Router();

adviceRouter.get('/', (req, res) => {
  const month = parseInt(String(req.query.month ?? '0'), 10);
  const valid = Number.isInteger(month) && month >= 0 && month <= 12;
  const articles = valid
    ? ADVICE_ARTICLES.filter((a) => a.month === month || a.month === 0)
    : ADVICE_ARTICLES;
  res.json({ articles });
});

adviceRouter.get('/diseases', (_req, res) => {
  res.json({ diseases: DISEASES });
});

adviceRouter.get('/varieties', (_req, res) => {
  res.json({ varieties: VARIETIES });
});

/** Everything the app needs to work offline: advice + diseases + stage definitions. */
adviceRouter.get('/handbook', (_req, res) => {
  res.json({
    articles: ADVICE_ARTICLES,
    diseases: DISEASES,
    varieties: VARIETIES,
    sprayStages: STAGE_DEFS.map((d) => ({ key: d.key, name: d.name, kind: d.kind, advice: d.advice })),
    elevationShiftExamples: {
      '1600m': elevationShiftDays(1600),
      '2000m': elevationShiftDays(2000),
      '2400m': elevationShiftDays(2400),
    },
    disclaimer:
      'Guidance is general for the Shimla apple belt and follows HP Horticulture extension practice. Always confirm products and rates with your Circle Horticulture Development Officer and the product label.',
  });
});
