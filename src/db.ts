import { Pool } from 'pg';
import { config } from './config.js';

/**
 * PostgreSQL connection pool for the MCP server.
 */
export const pool = new Pool({
  host: config.pgHost,
  port: config.pgPort,
  user: config.pgUser,
  password: config.pgPassword,
  database: config.pgDatabase,
  ssl: config.pgSsl ? {
    rejectUnauthorized: config.pgSslRejectUnauthorized
  } : undefined
});

/**
 * Helper to run a query using the pool.
 */
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows;
}
