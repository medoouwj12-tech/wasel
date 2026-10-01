require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });
process.env.TZ ||= 'Africa/Cairo';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { pool } = require('./db');

const sourcePath = path.resolve(process.env.SQLITE_SOURCE_PATH || path.join(__dirname, 'transport.db'));
const tables = [
  'users', 'routes', 'drivers', 'students', 'vehicles', 'pickup_points',
  'daily_operations', 'trips', 'bookings', 'attendances', 'settings', 'notifications', 'audit_logs',
];

function toPostgresValue(column, value) {
  if (typeof value === 'string' && column.endsWith('_at') && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    const parsed = new Date(value.replace(' ', 'T'));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return value;
}

async function migrate() {
  if (!fs.existsSync(sourcePath)) throw new Error(`SQLite source database not found: ${sourcePath}`);

  const sqlite = new DatabaseSync(sourcePath, { readOnly: true });
  const client = await pool.connect();
  try {
    const available = new Set(
      sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
    );
    await client.query('BEGIN');

    for (const table of tables) {
      if (!available.has(table)) continue;
      const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
      if (rows.length === 0) continue;
      const columns = Object.keys(rows[0]);
      const fields = columns.map((column) => `"${column}"`).join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const conflict = table === 'settings'
        ? 'ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value'
        : 'ON CONFLICT (id) DO NOTHING';
      const insert = `INSERT INTO public."${table}" (${fields}) VALUES (${placeholders}) ${conflict}`;

      for (const row of rows) {
        await client.query(insert, columns.map((column) => toPostgresValue(column, row[column])));
      }

      if (columns.includes('id')) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('public.${table}', 'id'),
                         COALESCE((SELECT MAX(id) FROM public."${table}"), 1),
                         EXISTS (SELECT 1 FROM public."${table}"))`
        );
      }
      console.log(`Migrated ${rows.length} rows from ${table}.`);
    }

    await client.query('COMMIT');
    console.log('SQLite data migration completed.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    sqlite.close();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(`SQLite migration failed: ${error.message}`);
  process.exitCode = 1;
});
