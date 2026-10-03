import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pool } from './db';
import { errorHandler, notFoundHandler } from './middleware/error';
import { photoStatic } from './photoStatic';
import { adviceRouter } from './routes/advice';
import { authRouter } from './routes/auth';
import { orchardsRouter } from './routes/orchards';
import { photosRouter } from './routes/photos';
import { sprayRouter } from './routes/spray';
import { surveysRouter } from './routes/surveys';
import { syncRouter } from './routes/sync';
import { treesRouter } from './routes/trees';

export function buildApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors()); // native mobile clients are not CORS-restricted; tighten for web deployments
  app.use(express.json({ limit: '2mb' }));

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: configLimit(),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'rate_limited', message: 'Too many requests - slow down' } },
  });
  app.use('/api', generalLimiter);

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true, db: 'up', time: new Date().toISOString() });
    } catch {
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  app.use('/photos', photoStatic());

  app.use('/api/auth', authRouter);
  app.use('/api/orchards', orchardsRouter);
  app.use('/api/trees', treesRouter);
  app.use('/api/photos', photosRouter);
  app.use('/api/surveys', surveysRouter);
  app.use('/api/spray', sprayRouter);
  app.use('/api/sync', syncRouter);
  app.use('/api/advice', adviceRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function configLimit(): number {
  return process.env.NODE_ENV === 'test' ? 100000 : 1000;
}
