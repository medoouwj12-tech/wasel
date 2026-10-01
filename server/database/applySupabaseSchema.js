require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to apply the Supabase schema.');
}

const migrationPath = path.resolve(__dirname, '../../supabase/migrations/0001_initial_schema.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');
const sslMode = process.env.DATABASE_SSL || 'verify-full';
const supabaseRootCertificate = fs.readFileSync(path.join(__dirname, 'prod-ca-2021.crt'), 'utf8');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15_000,
  ssl: sslMode === 'disable' ? false : { ca: supabaseRootCertificate, rejectUnauthorized: true },
});

async function applySchema() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(migration);
    await client.query('COMMIT');
    const { rows } = await client.query(
      "SELECT count(*)::int AS table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    );
    console.log(`Supabase schema applied. Public tables available: ${rows[0].table_count}.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applySchema().catch((error) => {
  console.error(`Supabase schema setup failed: ${error.message}`);
  process.exitCode = 1;
});
