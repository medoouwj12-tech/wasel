const { Pool, types } = require('pg');
const fs = require('fs');
const path = require('path');

// PostgreSQL BIGINT values are returned as strings by node-postgres by default.
types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1082, (value) => value);

const connectionString = process.env.DATABASE_URL;
const sslMode = process.env.DATABASE_SSL || 'verify-full';
const supabaseRootCertificate = fs.readFileSync(path.join(__dirname, 'prod-ca-2021.crt'), 'utf8');
if (!connectionString) {
  throw new Error('DATABASE_URL is required. Use the Supabase Transaction Pooler URL for Vercel.');
}

const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX || 1),
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  ssl: sslMode === 'disable' ? false : { ca: supabaseRootCertificate, rejectUnauthorized: true },
});
pool.on('error', (error) => console.error('Unexpected idle PostgreSQL client error:', error));

function toPostgres(sql) {
  let index = 0;
  const ignoreConflict = /^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql);
  let statement = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO')
    .replace(/\?/g, () => `$${++index}`);
  if (ignoreConflict && !/\bON\s+CONFLICT\b/i.test(statement)) statement += ' ON CONFLICT DO NOTHING';
  return statement;
}

async function queryAll(sql, params = []) {
  const result = await pool.query(toPostgres(sql), params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const result = await pool.query(toPostgres(sql), params);
  return result.rows[0];
}

async function run(sql, params = [], executor = pool) {
  let statement = toPostgres(sql);
  const insertTable = statement.match(/^\s*INSERT\s+INTO\s+(?:public\.)?(\w+)/i)?.[1];
  if (/^\s*INSERT\b/i.test(statement) && !/\bRETURNING\b/i.test(statement) && insertTable !== 'settings') {
    statement += ' RETURNING id';
  }
  const result = await executor.query(statement, params);
  const insertedId = result.rows[0]?.id;
  return {
    lastInsertRowid: insertedId == null ? undefined : Number(insertedId),
    changes: result.rowCount || 0,
    rows: result.rows,
  };
}

async function transaction(callback) {
  const client = await pool.connect();
  const tx = {
    queryAll: async (sql, params = []) => (await client.query(toPostgres(sql), params)).rows,
    queryOne: async (sql, params = []) => (await client.query(toPostgres(sql), params)).rows[0],
    run: (sql, params = []) => run(sql, params, client),
  };

  try {
    await client.query('BEGIN');
    const result = await callback(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function closeDatabase() {
  await pool.end();
}

module.exports = { pool, queryAll, queryOne, run, transaction, closeDatabase };
