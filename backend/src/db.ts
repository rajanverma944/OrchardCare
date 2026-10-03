import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { config } from './config';

const pool = new Pool({
  connectionString: config.isTest ? config.databaseUrlTest : config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export type DbClient = Pool | PoolClient;

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: readonly unknown[] = [],
  client?: DbClient,
): Promise<T[]> {
  const result = await (client ?? pool).query<T>(sql, params as unknown[]);
  return result.rows;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection already broken */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export { pool };
