import fs from 'node:fs';
import path from 'node:path';
import { pool } from './db';

const MIGRATIONS_DIR = [path.join(__dirname, '..', 'sql', 'migrations'), path.join(__dirname, '..', '..', 'sql', 'migrations')]
  .find((p) => fs.existsSync(p)) ?? path.join(__dirname, '..', 'sql', 'migrations');

/** Applies pending .sql migrations (each inside its own transaction). Idempotent. */
export async function runMigrations(): Promise<string[]> {
  const applied: string[] = [];
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const existing = new Set(
      (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map(
        (r) => r.name,
      ),
    );

    for (const file of files) {
      if (existing.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    client.release();
  }
  return applied;
}

/** CLI entry: npm run migrate */
if (require.main === module) {
  runMigrations()
    .then((applied) => {
      if (applied.length === 0) console.log('Database is up to date.');
      else console.log(`Applied ${applied.length} migration(s): ${applied.join(', ')}`);
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
