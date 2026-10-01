const { queryOne } = require('./db');

async function initSchema() {
  const result = await queryOne("SELECT to_regclass('public.users') AS users_table");
  if (!result?.users_table) {
    throw new Error('Supabase schema is missing. Run supabase/migrations/0001_initial_schema.sql in the Supabase SQL Editor.');
  }
}

module.exports = { initSchema };
