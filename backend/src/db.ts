import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !databaseUrl.trim()) {
  throw new Error('Database configuration is missing.');
}
export const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});
pool.on('error', (err) => {
  const errorCode =
    'code' in err && typeof err.code === 'string'
      ? err.code
      : 'UNKNOWN';
  const code = /^[A-Z0-9_]{1,40}$/.test(errorCode)
    ? errorCode
    : 'UNKNOWN';
  console.error('Unexpected PostgreSQL connection error', {
    code,
  });
});
