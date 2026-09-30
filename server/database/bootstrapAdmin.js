require('dotenv').config();

const bcrypt = require('bcryptjs');
const { initSchema } = require('./schema');
const { queryOne, run, transaction } = require('./db');

async function bootstrapAdmin() {
  const { INITIAL_ADMIN_NAME, INITIAL_ADMIN_PHONE, INITIAL_ADMIN_PASSWORD } = process.env;
  if (!INITIAL_ADMIN_NAME || !INITIAL_ADMIN_PHONE || !INITIAL_ADMIN_PASSWORD) {
    throw new Error('Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_PHONE, and INITIAL_ADMIN_PASSWORD before bootstrapping.');
  }
  if (INITIAL_ADMIN_PASSWORD.length < 12) {
    throw new Error('INITIAL_ADMIN_PASSWORD must contain at least 12 characters.');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_PATH) {
    throw new Error('Set DATABASE_PATH to the persistent production database location.');
  }
  if (!/^[0-9+()\-\s]{7,20}$/.test(INITIAL_ADMIN_PHONE.trim())) {
    throw new Error('INITIAL_ADMIN_PHONE has an invalid format.');
  }

  initSchema();
  if (queryOne('SELECT id FROM users WHERE phone = ?', [INITIAL_ADMIN_PHONE.trim()])) {
    throw new Error('An account already uses INITIAL_ADMIN_PHONE. Choose another phone number.');
  }

  const passwordHash = await bcrypt.hash(INITIAL_ADMIN_PASSWORD, 12);
  const user = transaction(({ run }) => run(
    `INSERT INTO users (full_name, phone, password_hash, role)
     VALUES (?, ?, ?, 'ADMIN')`,
    [INITIAL_ADMIN_NAME.trim(), INITIAL_ADMIN_PHONE.trim(), passwordHash]
  ));

  const defaults = [
    ['company_name', 'واصل لنقل الطلاب'],
    ['company_phone', ''],
    ['company_email', ''],
    ['allow_advance_booking_days', '3'],
    ['booking_cutoff_min', '30'],
    ['auto_close_time', '23:59'],
    ['allow_cancellation', 'true'],
    ['cancellation_cutoff_min', '60'],
    ['allow_student_self_check_in', 'false'],
  ];
  for (const [key, value] of defaults) {
    run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  console.log(`Created the initial administrator account (user id ${user.lastInsertRowid}).`);
  console.log('Sign in, change operational settings, then add routes, vehicles, drivers, and trips.');
}

bootstrapAdmin().catch((error) => {
  console.error(`Administrator bootstrap failed: ${error.message}`);
  process.exitCode = 1;
});
