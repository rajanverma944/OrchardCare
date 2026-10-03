import fs from 'node:fs';
import { config } from './config';
import { closePool, pool } from './db';
import { runMigrations } from './migrate';
import { buildApp } from './app';
import { pruneRefreshTokens } from './services/authService';

async function main(): Promise<void> {
  fs.mkdirSync(config.photosDir, { recursive: true });

  // Fail fast if the database is unreachable, and keep schema up to date.
  const applied = await runMigrations();
  if (applied.length > 0) console.log(`[db] applied migrations: ${applied.join(', ')}`);
  await pruneRefreshTokens();

  const app = buildApp();

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`OrchardCare API listening on ${config.publicBaseUrl} (port ${config.port})`);
    console.log(`Health check: ${config.publicBaseUrl}/health`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[shutdown] ${signal} received`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  void pool; // keep import for health checks
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
