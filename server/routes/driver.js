const express = require('express');
const { queryOne, queryAll, run, transaction } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getTodayString, isDateOpen } = require('../services/dailyOperationsService.pg');

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole('DRIVER', 'ADMIN'));

/**
 * GET /api/driver/trips
 * Get trips assigned to this driver for today (or custom date)
 */
router.get('/trips', async (req, res) => {
  try {
    const date = req.query.date || getTodayString();
    const isDriver = req.user.role === 'DRIVER';
    const driverId = isDriver ? req.driver.driver_id : null;

    let sql = `
      SELECT 
        t.id, t.trip_code, t.date, t.departure_time, t.capacity, t.booked_seats, t.status,
        r.id as route_id, r.name as route_name, r.start_location, r.end_location,
        v.id as vehicle_id, v.vehicle_number, v.plate_number, v.type as vehicle_type,
        u_drv.full_name as driver_name, u_drv.phone as driver_phone,
        (SELECT COUNT(a.id) FROM attendances a WHERE a.trip_id = t.id AND a.status = 'PRESENT') as present_count
      FROM trips t
      JOIN routes r ON t.route_id = r.id
      JOIN vehicles v ON t.vehicle_id = v.id
      JOIN drivers d ON t.driver_id = d.id
      JOIN users u_drv ON d.user_id = u_drv.id
      WHERE t.date = ?
    `;

    const params = [date];
    if (isDriver) {
      sql += ' AND t.driver_id = ?';
      params.push(driverId);
    }

    sql += ' ORDER BY t.departure_time ASC';

    const trips = await queryAll(sql, params);

    const enrichedTrips = await Promise.all(trips.map(async (t) => {
      const booked = t.booked_seats;
      const present = t.present_count;
      const finalized = ['COMPLETED', 'CANCELLED'].includes(t.status) || t.date < getTodayString() || !await isDateOpen(t.date);
      const absent = finalized ? Math.max(0, booked - present) : 0;
      return {
        ...t,
        absent_count: absent,
        pending_count: Math.max(0, booked - present - absent),
        occupancy_rate: t.capacity > 0 ? Math.round((booked / t.capacity) * 100) : 0,
      };
    }));

    return res.json({
      success: true,
      date,
      trips: enrichedTrips,
    });
  } catch (error) {
    console.error('Driver trips error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل رحلات السائق.' });
  }
});

/**
 * GET /api/driver/trip/:id/manifest
 * Passenger manifest with pickup points and attendance status
 */
router.get('/trip/:id/manifest', async (req, res) => {
  try {
    const tripId = req.params.id;

    const trip = await queryOne(
      `SELECT t.*, r.name as route_name, v.vehicle_number, v.plate_number, u.full_name as driver_name
       FROM trips t
       JOIN routes r ON t.route_id = r.id
       JOIN vehicles v ON t.vehicle_id = v.id
       JOIN drivers d ON t.driver_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE t.id = ?`,
      [tripId]
    );

    if (!trip) {
      return res.status(404).json({ success: false, message: 'الرحلة غير موجودة.' });
    }

    // Security check: if driver, ensure this trip is assigned to them
    if (req.user.role === 'DRIVER' && trip.driver_id !== req.driver.driver_id) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك باستعراض رحلة مخصصة لسائق آخر.' });
    }

    // Fetch all confirmed bookings for this trip
    const passengers = await queryAll(
      `SELECT 
        b.id as booking_id, b.booking_code, b.date, b.qr_code_token,
        s.id as student_id, s.student_code, s.emergency_phone, s.institution,
        u.full_name as student_name, u.phone as student_phone,
        p.id as pickup_point_id, p.name as pickup_name, p.sequence_order, p.expected_time_offset_min,
        a.id as attendance_id, a.status as attendance_status, a.method as attendance_method, a.checked_in_at
       FROM bookings b
       JOIN students s ON b.student_id = s.id
       JOIN users u ON s.user_id = u.id
       JOIN pickup_points p ON b.pickup_point_id = p.id
       LEFT JOIN attendances a ON a.booking_id = b.id
       WHERE b.trip_id = ? AND b.status = 'CONFIRMED'
       ORDER BY p.sequence_order ASC, u.full_name ASC`,
      [tripId]
    );

    // Group by pickup point for ease of driver onboarding
    const pickups = await queryAll(
      `SELECT id, name, sequence_order, expected_time_offset_min, landmark
       FROM pickup_points
       WHERE route_id = ?
       ORDER BY sequence_order ASC`,
      [trip.route_id]
    );

    const presentCount = passengers.filter((p) => p.attendance_status === 'PRESENT').length;
    const finalized = ['COMPLETED', 'CANCELLED'].includes(trip.status) || trip.date < getTodayString() || !await isDateOpen(trip.date);
    const absentCount = finalized ? passengers.length - presentCount : 0;

    return res.json({
      success: true,
      trip: {
        ...trip,
        booked_count: passengers.length,
        present_count: presentCount,
        absent_count: absentCount,
        pending_count: passengers.length - presentCount - absentCount,
      },
      pickups,
      passengers: passengers.map((p) => ({
        ...p,
        is_present: p.attendance_status === 'PRESENT',
      })),
    });
  } catch (error) {
    console.error('Trip manifest error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل قائمة ركاب الرحلة.' });
  }
});

/**
 * POST /api/driver/scan-qr
 * Scan student QR code and mark attendance
 */
router.post('/scan-qr', async (req, res) => {
  try {
    const { qr_token, trip_id } = req.body;

    if (typeof qr_token !== 'string' || !qr_token.trim()) {
      return res.status(400).json({ success: false, message: 'رمز QR غير موجود.' });
    }

    const tripId = Number.parseInt(trip_id, 10);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      return res.status(400).json({ success: false, message: 'معرف الرحلة مطلوب لفحص رمز الصعود.' });
    }

    const trip = await queryOne('SELECT id, driver_id, status as trip_status FROM trips WHERE id = ?', [tripId]);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة.' });
    if (req.user.role === 'DRIVER' && (!req.driver || trip.driver_id !== req.driver.driver_id)) {
      return res.status(403).json({ success: false, message: 'هذه الرحلة غير مخصصة لحسابك.' });
    }

    // Only the unguessable QR token is accepted; booking codes are not credentials.
    const booking = await queryOne(
      `SELECT 
        b.id as booking_id, b.booking_code, b.trip_id, b.date, b.status as booking_status,
        s.id as student_id, s.student_code,
        u.full_name as student_name, u.phone as student_phone,
        p.name as pickup_name,
        t.status as trip_status
       FROM bookings b
       JOIN students s ON b.student_id = s.id
       JOIN users u ON s.user_id = u.id
       JOIN pickup_points p ON b.pickup_point_id = p.id
       JOIN trips t ON b.trip_id = t.id
       WHERE b.qr_code_token = ?`,
      [qr_token.trim()]
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'رمز QR غير صحيح أو غير مسجل في النظام.',
      });
    }

    if (booking.booking_status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: 'هذا الحجز ملغى ولا يمكن قبول حضور الطالب.',
      });
    }

    // If trip_id is specified in the scanner context, verify it belongs to this trip
    if (tripId !== booking.trip_id) {
      return res.status(400).json({
        success: false,
        message: 'هذا الحجز مسجل على رحلة أو مركبة أخرى!',
      });
    }

    if (trip.trip_status !== 'IN_TRANSIT') {
      return res.status(400).json({ success: false, message: 'ابدأ الرحلة من لوحة السائق قبل تسجيل صعود الطلاب.' });
    }

    // Check if the day is open
    if (!await isDateOpen(booking.date)) {
      return res.status(400).json({
        success: false,
        message: 'دورة هذا اليوم مغلقة ولا يمكن تسجيل الحضور بعد الإغلاق.',
      });
    }

    // Check if already checked in
    const existing = await queryOne(
      'SELECT id, checked_in_at, method FROM attendances WHERE booking_id = ?',
      [booking.booking_id]
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `تم تسجيل حضور الطالب (${booking.student_name}) مسبقاً في الساعة ${existing.checked_in_at}`,
        student: {
          name: booking.student_name,
          code: booking.student_code,
          booking_code: booking.booking_code,
          pickup_name: booking.pickup_name,
          checked_in_at: existing.checked_in_at,
          already_present: true,
        },
      });
    }

    // Record attendance
    const attendanceRes = await run(
      `INSERT INTO attendances (booking_id, student_id, trip_id, date, status, method, checked_in_at, verified_by_user_id)
       VALUES (?, ?, ?, ?, 'PRESENT', 'DRIVER_QR_SCAN', CURRENT_TIMESTAMP, ?)`,
      [booking.booking_id, booking.student_id, booking.trip_id, booking.date, req.user.id]
    );

    const recorded = await queryOne('SELECT checked_in_at FROM attendances WHERE id = ?', [attendanceRes.lastInsertRowid]);

    return res.json({
      success: true,
      message: `تم التحقق بنجاح! تم تسجيل حضور: ${booking.student_name}`,
      student: {
        id: booking.student_id,
        name: booking.student_name,
        phone: booking.student_phone,
        code: booking.student_code,
        booking_code: booking.booking_code,
        pickup_name: booking.pickup_name,
        checked_in_at: recorded.checked_in_at,
      },
    });
  } catch (error) {
    console.error('QR Scan error:', error);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء فحص رمز QR.' });
  }
});

/**
 * POST /api/driver/toggle-attendance
 * Manual check-in / undo toggle by driver for a student
 */
router.post('/toggle-attendance', async (req, res) => {
  try {
    const booking_id = Number.parseInt(req.body.booking_id, 10);
    if (!Number.isInteger(booking_id) || booking_id <= 0) {
      return res.status(400).json({ success: false, message: 'معرف الحجز مطلوب.' });
    }

    const booking = await queryOne(
      `SELECT b.id, b.student_id, b.trip_id, b.date, b.status, t.driver_id, t.status as trip_status
       FROM bookings b JOIN trips t ON t.id = b.trip_id
       WHERE b.id = ?`,
      [booking_id]
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'الحجز غير موجود.' });
    }

    if (req.user.role === 'DRIVER' && (!req.driver || booking.driver_id !== req.driver.driver_id)) {
      return res.status(403).json({ success: false, message: 'هذا الحجز تابع لرحلة غير مخصصة لحسابك.' });
    }
    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({ success: false, message: 'الحجز غير مؤكد.' });
    }
    if (booking.trip_status !== 'IN_TRANSIT') {
      return res.status(400).json({ success: false, message: 'ابدأ الرحلة قبل تسجيل حضور الركاب.' });
    }

    if (!await isDateOpen(booking.date)) {
      return res.status(400).json({ success: false, message: 'دورة هذا اليوم مغلقة.' });
    }

    const existing = await queryOne('SELECT id FROM attendances WHERE booking_id = ?', [booking_id]);

    if (existing) {
      // Toggle off / remove attendance
      await run('DELETE FROM attendances WHERE id = ?', [existing.id]);
      return res.json({
        success: true,
        action: 'REMOVED',
        message: 'تم إلغاء تسجيل الحضور لهذا الطالب.',
      });
    } else {
      // Toggle on / mark present
      await run(
        `INSERT INTO attendances (booking_id, student_id, trip_id, date, status, method, checked_in_at, verified_by_user_id)
         VALUES (?, ?, ?, ?, 'PRESENT', 'DRIVER_MANUAL', CURRENT_TIMESTAMP, ?)`,
        [booking.id, booking.student_id, booking.trip_id, booking.date, req.user.id]
      );
      return res.json({
        success: true,
        action: 'MARKED_PRESENT',
        message: 'تم تسجيل الحضور يدوياً بنجاح ✓',
      });
    }
  } catch (error) {
    console.error('Toggle attendance error:', error);
    return res.status(500).json({ success: false, message: 'فشل تغيير حالة الحضور.' });
  }
});

/**
 * POST /api/driver/trip/:id/finish
 * Mark trip as completed
 */
router.post('/trip/:id/finish', async (req, res) => {
  try {
    const tripId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      return res.status(400).json({ success: false, message: 'معرف الرحلة غير صالح.' });
    }
    const trip = await queryOne('SELECT id, driver_id, status FROM trips WHERE id = ?', [tripId]);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة.' });
    if (req.user.role === 'DRIVER' && (!req.driver || trip.driver_id !== req.driver.driver_id)) {
      return res.status(403).json({ success: false, message: 'هذه الرحلة غير مخصصة لحسابك.' });
    }
    if (trip.status !== 'IN_TRANSIT') {
      return res.status(400).json({ success: false, message: 'لا يمكن إنهاء رحلة لم تبدأ أو تم إنهاؤها بالفعل.' });
    }
    await run("UPDATE trips SET status = 'COMPLETED' WHERE id = ?", [tripId]);
    return res.json({ success: true, message: 'تم إنهاء الرحلة بنجاح. شكراً لك!' });
  } catch (error) {
    console.error('Finish trip error:', error);
    return res.status(500).json({ success: false, message: 'فشل إنهاء الرحلة.' });
  }
});

/** Start an assigned trip before the driver records boardings. */
router.post('/trip/:id/start', async (req, res) => {
  try {
    const tripId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      return res.status(400).json({ success: false, message: 'معرف الرحلة غير صالح.' });
    }
    const trip = await queryOne('SELECT id, driver_id, date, status FROM trips WHERE id = ?', [tripId]);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة.' });
    if (req.user.role === 'DRIVER' && (!req.driver || trip.driver_id !== req.driver.driver_id)) {
      return res.status(403).json({ success: false, message: 'هذه الرحلة غير مخصصة لحسابك.' });
    }
    if (trip.status !== 'SCHEDULED') {
      return res.status(400).json({ success: false, message: 'لا يمكن بدء هذه الرحلة بحالتها الحالية.' });
    }
    if (!await isDateOpen(trip.date)) {
      return res.status(400).json({ success: false, message: 'دورة يوم الرحلة مغلقة.' });
    }
    await run("UPDATE trips SET status = 'IN_TRANSIT' WHERE id = ?", [tripId]);
    return res.json({ success: true, message: 'بدأت الرحلة. يمكنك الآن مسح رموز الصعود أو تسجيل الحضور يدوياً.' });
  } catch (error) {
    console.error('Start trip error:', error);
    return res.status(500).json({ success: false, message: 'فشل بدء الرحلة.' });
  }
});

module.exports = router;
