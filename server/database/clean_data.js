const bcrypt = require('bcryptjs');
const { db, run, exec, queryOne } = require('./db');
const { initSchema } = require('./schema');
const { getTodayString } = require('../services/dailyOperationsService');

async function cleanData() {
  console.log('--- Cleaning all mock/dummy data from database ---');
  initSchema();

  // Clear all non-admin data
  exec(`
    DELETE FROM attendances;
    DELETE FROM bookings;
    DELETE FROM trips;
    DELETE FROM pickup_points;
    DELETE FROM routes;
    DELETE FROM vehicles;
    DELETE FROM drivers;
    DELETE FROM students;
    DELETE FROM users WHERE role != 'ADMIN';
    DELETE FROM daily_operations;
    DELETE FROM notifications;
    DELETE FROM audit_logs;
  `);

  // Ensure Admin user exists
  const salt = await bcrypt.genSalt(10);
  const hashAdmin = await bcrypt.hash('admin123', salt);

  const existingAdmin = queryOne("SELECT id FROM users WHERE role = 'ADMIN'");
  let adminId;
  if (!existingAdmin) {
    const res = run(
      `INSERT INTO users (full_name, phone, email, password_hash, role)
       VALUES (?, ?, ?, ?, 'ADMIN')`,
      ['مدير النظام', '01000000000', 'admin@wasel.com', hashAdmin]
    );
    adminId = res.lastInsertRowid;
  } else {
    adminId = existingAdmin.id;
  }

  // Ensure today's daily cycle is created cleanly with 0 trips/bookings
  const today = getTodayString();
  run(
    `INSERT OR REPLACE INTO daily_operations (date, status, opened_at, notes)
     VALUES (?, 'OPEN', datetime('now', 'localtime'), ?)`,
    [today, 'دورة اليوم مفتوحة وجاهزة لاستقبال الحجوزات والرحلات']
  );

  console.log('--- Database is now 100% CLEAN of all fake data ---');
  console.log('Admin account: 01000000000 / admin123');
  console.log('The Admin can now add real vehicles, routes, directions, drivers, and trips freely.');
}

if (require.main === module) {
  cleanData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error cleaning data:', err);
      process.exit(1);
    });
}

module.exports = { cleanData };
