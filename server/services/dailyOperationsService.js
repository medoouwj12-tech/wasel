const { queryOne, queryAll, run, transaction } = require('../database/db');

/**
 * Format Date as YYYY-MM-DD
 */
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSetting(key, fallback) {
  return queryOne('SELECT value FROM settings WHERE key = ?', [key])?.value ?? fallback;
}

function getMinutesUntilDeparture(dateStr, departureTime, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(departureTime || '')) {
    return Number.NEGATIVE_INFINITY;
  }
  const departure = new Date(`${dateStr}T${departureTime}:00`);
  if (Number.isNaN(departure.getTime())) return Number.NEGATIVE_INFINITY;
  return (departure.getTime() - now.getTime()) / 60000;
}

function getMaxAdvanceBookingDays() {
  const parsed = Number.parseInt(getSetting('allow_advance_booking_days', '3'), 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 14) : 3;
}

/**
 * Get or create daily operations record for a given date
 */
function getOrCreateCycle(dateStr = getTodayString()) {
  let cycle = queryOne('SELECT * FROM daily_operations WHERE date = ?', [dateStr]);
  if (!cycle) {
    run(
      `INSERT INTO daily_operations (date, status, opened_at, notes)
       VALUES (?, 'OPEN', datetime('now', 'localtime'), ?)`,
      [dateStr, 'تم فتح دورة اليوم تلقائياً بواسطة النظام']
    );
    cycle = queryOne('SELECT * FROM daily_operations WHERE date = ?', [dateStr]);
  }
  return cycle;
}

/**
 * Check if a date cycle is open
 */
function isDateOpen(dateStr) {
  const cycle = queryOne('SELECT status FROM daily_operations WHERE date = ?', [dateStr]);
  if (!cycle) {
    // If not created yet, default today or future dates to open
    const today = getTodayString();
    return dateStr >= today;
  }
  return cycle.status === 'OPEN';
}

/**
 * Manually or automatically close a day
 */
function closeDay(dateStr, closedByUserId = null, notes = null) {
  const existing = getOrCreateCycle(dateStr);
  if (existing.status === 'CLOSED') {
    return { success: false, message: 'اليوم مغلق بالفعل مسبقاً.' };
  }

  // Closing the cycle finalizes any bookings that do not have an attendance record.
  run(
    `UPDATE daily_operations 
     SET status = 'CLOSED', 
         closed_at = datetime('now', 'localtime'), 
         closed_by = ?,
         notes = COALESCE(?, notes, 'تم إغلاق اليوم واعتماد السجلات')
     WHERE date = ?`,
    [closedByUserId, notes, dateStr]
  );

  return { success: true, message: `تم إغلاق دورة يوم ${dateStr} بنجاح وحفظ كافة السجلات للتقارير.` };
}

/** Close any overdue open day cycles using the configured local server time. */
function closeExpiredCycles(now = new Date()) {
  const today = getTodayString();
  const autoCloseTime = getSetting('auto_close_time', '23:59');
  const validCloseTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(autoCloseTime) ? autoCloseTime : '23:59';
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const overdue = queryAll("SELECT date FROM daily_operations WHERE status = 'OPEN' AND date < ?", [today]);
  overdue.forEach(({ date }) => closeDay(date, null, 'تم إغلاق اليوم تلقائياً بواسطة النظام'));

  if (currentTime >= validCloseTime && isDateOpen(today)) {
    closeDay(today, null, 'تم إغلاق اليوم تلقائياً بواسطة النظام');
  }
}

/**
 * Open or reopen a day
 */
function openDay(dateStr) {
  getOrCreateCycle(dateStr);
  run(
    `UPDATE daily_operations 
     SET status = 'OPEN', 
         closed_at = NULL, 
         closed_by = NULL 
     WHERE date = ?`,
    [dateStr]
  );
  return { success: true, message: `تم فتح دورة يوم ${dateStr} بنجاح.` };
}

/**
 * Get detailed statistics for a specific date
 */
function getDateStats(dateStr) {
  const cycle = queryOne('SELECT * FROM daily_operations WHERE date = ?', [dateStr]) || {
    date: dateStr,
    status: dateStr < getTodayString() ? 'CLOSED' : 'OPEN',
  };

  const tripsStats = queryOne(
    `SELECT COUNT(id) as total_trips,
            COALESCE(SUM(capacity), 0) as total_capacity,
            COALESCE(SUM(booked_seats), 0) as total_booked
     FROM trips
     WHERE date = ?`,
    [dateStr]
  ) || { total_trips: 0, total_capacity: 0, total_booked: 0 };

  const bookingsCount = queryOne(
    `SELECT COUNT(id) as count FROM bookings WHERE date = ? AND status = 'CONFIRMED'`,
    [dateStr]
  )?.count || 0;

  const attendanceStats = queryOne(
    `SELECT 
        COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) as present_count,
        COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) as absent_count
     FROM attendances
     WHERE date = ?`,
    [dateStr]
  ) || { present_count: 0, absent_count: 0 };

  // A missing scan becomes an absence only after the day or its trip is finalized.
  const present = attendanceStats.present_count;
  const absent = cycle.status === 'CLOSED' || dateStr < getTodayString()
    ? Math.max(0, bookingsCount - present)
    : queryOne(
      `SELECT COUNT(b.id) as count
       FROM bookings b
       JOIN trips t ON t.id = b.trip_id
       LEFT JOIN attendances a ON a.booking_id = b.id AND a.status = 'PRESENT'
       WHERE b.date = ? AND b.status = 'CONFIRMED'
         AND a.id IS NULL AND t.status IN ('COMPLETED', 'CANCELLED')`,
      [dateStr]
    )?.count || 0;
  const pending = Math.max(0, bookingsCount - present - absent);

  return {
    date: dateStr,
    status: cycle.status,
    opened_at: cycle.opened_at,
    closed_at: cycle.closed_at,
    total_trips: tripsStats.total_trips,
    total_capacity: tripsStats.total_capacity,
    total_booked: bookingsCount,
    present_count: present,
    absent_count: absent,
    pending_count: pending,
    attendance_rate: bookingsCount > 0 ? Math.round((present / bookingsCount) * 100) : 0,
  };
}

/**
 * List all daily cycles with aggregated numbers for Admin Daily Operations table
 */
function listAllCycles() {
  const cycles = queryAll(
    `SELECT d.*, u.full_name as closed_by_name
     FROM daily_operations d
     LEFT JOIN users u ON d.closed_by = u.id
     ORDER BY d.date DESC`
  );

  return cycles.map((c) => {
    const stats = getDateStats(c.date);
    return {
      ...c,
      ...stats,
    };
  });
}

module.exports = {
  getTodayString,
  getTomorrowString,
  getSetting,
  getMinutesUntilDeparture,
  getMaxAdvanceBookingDays,
  getOrCreateCycle,
  isDateOpen,
  closeDay,
  closeExpiredCycles,
  openDay,
  getDateStats,
  listAllCycles,
};
