const { queryOne, queryAll, run } = require('../database/db');

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getSetting(key, fallback) {
  const row = await queryOne('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? fallback;
}

function getMinutesUntilDeparture(dateStr, departureTime, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(departureTime || '')) return Number.NEGATIVE_INFINITY;
  const departure = new Date(`${dateStr}T${departureTime}:00`);
  return Number.isNaN(departure.getTime()) ? Number.NEGATIVE_INFINITY : (departure.getTime() - now.getTime()) / 60000;
}

async function getMaxAdvanceBookingDays() {
  const parsed = Number.parseInt(await getSetting('allow_advance_booking_days', '3'), 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 14) : 3;
}

async function getOrCreateCycle(dateStr = getTodayString()) {
  const existing = await queryOne('SELECT * FROM daily_operations WHERE date = ?', [dateStr]);
  if (existing) return existing;
  await run(
    `INSERT INTO daily_operations (date, status, opened_at, notes)
     VALUES (?, 'OPEN', CURRENT_TIMESTAMP, ?)
     ON CONFLICT (date) DO NOTHING`,
    [dateStr, 'تم فتح دورة اليوم تلقائياً بواسطة النظام']
  );
  return queryOne('SELECT * FROM daily_operations WHERE date = ?', [dateStr]);
}

async function isDateOpen(dateStr) {
  const cycle = await queryOne('SELECT status FROM daily_operations WHERE date = ?', [dateStr]);
  return cycle ? cycle.status === 'OPEN' : dateStr >= getTodayString();
}

async function closeDay(dateStr, closedByUserId = null, notes = null) {
  const existing = await getOrCreateCycle(dateStr);
  if (existing.status === 'CLOSED') return { success: false, message: 'اليوم مغلق بالفعل مسبقاً.' };
  await run(
    `UPDATE daily_operations
     SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP, closed_by = ?,
         notes = COALESCE(?, notes, 'تم إغلاق اليوم واعتماد السجلات')
     WHERE date = ?`,
    [closedByUserId, notes, dateStr]
  );
  return { success: true, message: `تم إغلاق دورة يوم ${dateStr} بنجاح وحفظ كافة السجلات للتقارير.` };
}

async function closeExpiredCycles(now = new Date()) {
  const today = getTodayString();
  const autoCloseTime = await getSetting('auto_close_time', '23:59');
  const validCloseTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(autoCloseTime) ? autoCloseTime : '23:59';
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const overdue = await queryAll("SELECT date FROM daily_operations WHERE status = 'OPEN' AND date < ?", [today]);
  for (const { date } of overdue) await closeDay(date, null, 'تم إغلاق اليوم تلقائياً بواسطة النظام');
  if (currentTime >= validCloseTime && await isDateOpen(today)) {
    await closeDay(today, null, 'تم إغلاق اليوم تلقائياً بواسطة النظام');
  }
}

async function openDay(dateStr) {
  await getOrCreateCycle(dateStr);
  await run(
    `UPDATE daily_operations SET status = 'OPEN', closed_at = NULL, closed_by = NULL WHERE date = ?`,
    [dateStr]
  );
  return { success: true, message: `تم فتح دورة يوم ${dateStr} بنجاح.` };
}

async function getDateStats(dateStr) {
  const cycle = await queryOne('SELECT * FROM daily_operations WHERE date = ?', [dateStr]) || {
    date: dateStr,
    status: dateStr < getTodayString() ? 'CLOSED' : 'OPEN',
  };
  const tripsStats = await queryOne(
    `SELECT COUNT(id) AS total_trips, COALESCE(SUM(capacity), 0) AS total_capacity,
            COALESCE(SUM(booked_seats), 0) AS total_booked FROM trips WHERE date = ?`, [dateStr]
  ) || { total_trips: 0, total_capacity: 0, total_booked: 0 };
  const bookingsCount = Number((await queryOne(
    "SELECT COUNT(id) AS count FROM bookings WHERE date = ? AND status = 'CONFIRMED'", [dateStr]
  ))?.count || 0);
  const attendanceStats = await queryOne(
    `SELECT COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) AS present_count,
            COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) AS absent_count FROM attendances WHERE date = ?`, [dateStr]
  ) || { present_count: 0, absent_count: 0 };
  const present = Number(attendanceStats.present_count || 0);
  const absent = cycle.status === 'CLOSED' || dateStr < getTodayString()
    ? Math.max(0, bookingsCount - present)
    : Number((await queryOne(
      `SELECT COUNT(b.id) AS count FROM bookings b JOIN trips t ON t.id = b.trip_id
       LEFT JOIN attendances a ON a.booking_id = b.id AND a.status = 'PRESENT'
       WHERE b.date = ? AND b.status = 'CONFIRMED' AND a.id IS NULL AND t.status IN ('COMPLETED', 'CANCELLED')`,
      [dateStr]
    ))?.count || 0);
  const pending = Math.max(0, bookingsCount - present - absent);
  return {
    date: dateStr, status: cycle.status, opened_at: cycle.opened_at, closed_at: cycle.closed_at,
    total_trips: Number(tripsStats.total_trips || 0), total_capacity: Number(tripsStats.total_capacity || 0),
    total_booked: bookingsCount, present_count: present, absent_count: absent, pending_count: pending,
    attendance_rate: bookingsCount > 0 ? Math.round((present / bookingsCount) * 100) : 0,
  };
}

async function listAllCycles() {
  const cycles = await queryAll(
    `SELECT d.*, u.full_name AS closed_by_name FROM daily_operations d
     LEFT JOIN users u ON d.closed_by = u.id ORDER BY d.date DESC`
  );
  return Promise.all(cycles.map(async (cycle) => ({ ...cycle, ...await getDateStats(cycle.date) })));
}

module.exports = {
  getTodayString, getTomorrowString, getSetting, getMinutesUntilDeparture, getMaxAdvanceBookingDays,
  getOrCreateCycle, isDateOpen, closeDay, closeExpiredCycles, openDay, getDateStats, listAllCycles,
};
