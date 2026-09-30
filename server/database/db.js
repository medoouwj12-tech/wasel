const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, 'transport.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode for reliability and speed
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
`);

/**
 * Helper to query multiple rows
 */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

/**
 * Helper to query a single row
 */
function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

/**
 * Helper to execute INSERT, UPDATE, DELETE
 */
function run(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

/**
 * Helper to execute multiple raw SQL statements
 */
function exec(sql) {
  return db.exec(sql);
}

/**
 * Helper to run transactions safely
 */
function transaction(fn) {
  db.exec('BEGIN TRANSACTION;');
  try {
    const result = fn({ queryAll, queryOne, run, exec });
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

module.exports = {
  db,
  queryAll,
  queryOne,
  run,
  exec,
  transaction,
};
