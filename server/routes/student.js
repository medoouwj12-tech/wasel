const express = require('express');
const crypto = require('crypto');
const { queryOne, queryAll, run, transaction } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  getTodayString,
  getTomorrowString,
  getSetting,
  getMinutesUntilDeparture,
  getMaxAdvanceBookingDays,
  isDateOpen,
} = require('../services/dailyOperationsService');

const router = express.Router();

// Apply auth & student role to all student endpoints
router.use(authenticateToken);
router.use(requireRole('STUDENT'));

/**
 * Format Arabic Date string e.g. "30 سبتمبر 2026"
 */
function formatArabicDate(dateStr) {
  try {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return date.toLocaleDateString('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * GET /api/student/dashboard
 * Complete student dashboard with today's state, trip, booking, and attendance status
 */
router.get('/dashboard', (req, res) => {
  try {
    const student = req.student;
    if (!student) {
      return res.status(404).json({ success: false, message: 'ملف الطالب غير موجود.' });
    }

    const today = getTodayString();
    const tomorrow = getTomorrowString();
    const isTodayOpen = isDateOpen(today);
    const selfCheckInEnabled = getSetting('allow_student_self_check_in', 'false') === 'true';

    // Look for today's booking
    const todayBooking = queryOne(
      `SELECT 
        b.id as booking_id, b.booking_code, b.date, b.status as booking_status, b.qr_code_token, b.created_at as booked_at,
        t.id as trip_id, t.trip_code, t.departure_time, t.status as trip_status,
        r.name as route_name, r.start_location, r.end_location,
        p.id as pickup_point_id, p.name as pickup_name, p.expected_time_offset_min, p.landmark as pickup_landmark,
        v.vehicle_number, v.plate_number, v.type as vehicle_type,
        u_drv.full_name as driver_name, u_drv.phone as driver_phone,
        a.id as attendance_id, a.status as attendance_status, a.method as attendance_method, a.checked_in_at
       FROM bookings b
       JOIN trips t ON b.trip_id = t.id
       JOIN routes r ON t.route_id = r.id
       JOIN pickup_points p ON b.pickup_point_id = p.id
       JOIN vehicles v ON t.vehicle_id = v.id
       JOIN drivers d ON t.driver_id = d.id
       JOIN users u_drv ON d.user_id = u_drv.id
       LEFT JOIN attendances a ON a.booking_id = b.id
       WHERE b.student_id = ? AND b.date = ? AND b.status = 'CONFIRMED'`,
      [student.student_id, today]
    );

    // Look for tomorrow's booking
    const tomorrowBooking = queryOne(
      `SELECT b.id as booking_id, b.booking_code, t.departure_time, r.name as route_name, v.vehicle_number
       FROM bookings b
       JOIN trips t ON b.trip_id = t.id
       JOIN routes r ON t.route_id = r.id
       JOIN vehicles v ON t.vehicle_id = v.id
       WHERE b.student_id = ? AND b.date = ? AND b.status = 'CONFIRMED'`,
      [student.student_id, tomorrow]
    );

    // Check if trips are available for booking tomorrow
    const tomorrowTripsCount = queryOne(
      `SELECT COUNT(id) as count FROM trips WHERE date = ? AND status = 'SCHEDULED' AND booked_seats < capacity`,
      [tomorrow]
    )?.count || 0;

    return res.json({
      success: true,
      data: {
        student: {
          id: student.student_id,
          code: student.student_code,
          name: req.user.full_name,
          phone: req.user.phone,
          institution: student.institution,
          default_pickup: student.default_pickup_name,
        },
        today: {
          date: today,
          formatted_date: formatArabicDate(today),
          is_open: isTodayOpen,
          allow_self_check_in: selfCheckInEnabled,
          booking: todayBooking ? {
            booking_id: todayBooking.booking_id,
            booking_code: todayBooking.booking_code,
            trip_id: todayBooking.trip_id,
            trip_code: todayBooking.trip_code,
            route_name: todayBooking.route_name,
            departure_time: todayBooking.departure_time,
            trip_status: todayBooking.trip_status,
            vehicle_number: todayBooking.vehicle_number,
            vehicle_plate: todayBooking.vehicle_plate,
            vehicle_type: todayBooking.vehicle_type,
            driver_name: todayBooking.driver_name,
            driver_phone: todayBooking.driver_phone,
            pickup_name: todayBooking.pickup_name,
            pickup_landmark: todayBooking.pickup_landmark,
            qr_code_token: todayBooking.qr_code_token,
            is_present: todayBooking.attendance_status === 'PRESENT',
            attendance_status: todayBooking.attendance_status || 'NOT_CHECKED_IN',
            attendance_method: todayBooking.attendance_method || null,
            checked_in_at: todayBooking.checked_in_at || null,
          } : null,
        },
        tomorrow: {
          date: tomorrow,
          formatted_date: formatArabicDate(tomorrow),
          has_booking: !!tomorrowBooking,
          booking: tomorrowBooking || null,
          trips_available: tomorrowTripsCount,
        },
      },
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء تحميل لوحة الطالب.' });
  }
});

/**
 * POST /api/student/attendance/check-in
 * Self attendance check-in by the student
 */
router.post('/attendance/check-in', (req, res) => {
  try {
    const student = req.student;
    if (!student) {
      return res.status(404).json({ success: false, message: 'بيانات الطالب غير موجودة.' });
    }

    const today = getTodayString();

    if (getSetting('allow_student_self_check_in', 'false') !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'الحضور يسجله السائق عند الصعود. اعرض رمز QR للسائق لتأكيد حضورك.',
      });
    }

    // 1. Check if today's cycle is OPEN
    if (!isDateOpen(today)) {
      return res.status(400).json({
        success: false,
        message: 'عذراً، تم إغلاق دورة اليوم من قبل الإدارة. لا يمكن تسجيل الحضور بعد الإغلاق.',
      });
    }

    // 2. Fetch today's confirmed booking
    const booking = queryOne(
      `SELECT b.id, b.trip_id, b.student_id, b.status, t.status as trip_status
       FROM bookings b
       JOIN trips t ON b.trip_id = t.id
       WHERE b.student_id = ? AND b.date = ? AND b.status = 'CONFIRMED'`,
      [student.student_id, today]
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'ليس لديك حجز مؤكد لرحلة اليوم. يُرجى حجز رحلة أولاً لتتمكن من تسجيل الحضور.',
      });
    }

    if (booking.trip_status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'تم إلغاء هذه الرحلة من قبل الإدارة.',
      });
    }

    // 3. Check if already checked in
    const existingAttendance = queryOne(
      'SELECT id, checked_in_at, method FROM attendances WHERE booking_id = ?',
      [booking.id]
    );

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: `تم تسجيل حضورك مسبقاً لهذا اليوم في تمام الساعة ${existingAttendance.checked_in_at}.`,
        checked_in_at: existingAttendance.checked_in_at,
        is_already_present: true,
      });
    }

    // 4. Perform atomic check-in insertion
    const result = transaction(({ run, queryOne }) => {
      run(
        `INSERT INTO attendances (booking_id, student_id, trip_id, date, status, method, checked_in_at)
         VALUES (?, ?, ?, ?, 'PRESENT', 'SELF_APP', datetime('now', 'localtime'))`,
        [booking.id, student.student_id, booking.trip_id, today]
      );

      return queryOne('SELECT * FROM attendances WHERE booking_id = ?', [booking.id]);
    });

    return res.json({
      success: true,
      message: 'تم تسجيل حضورك بنجاح ✓ نتمنى لك رحلة سعيدة وآمنة!',
      data: {
        attendance_id: result.id,
        status: 'PRESENT',
        method: 'SELF_APP',
        checked_in_at: result.checked_in_at,
      },
    });
  } catch (error) {
    console.error('Self check-in error:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تسجيل الحضور. يرجى المحاولة مرة أخرى.',
    });
  }
});

/**
 * GET /api/student/available-trips
 * List available trips for a specific date (today or tomorrow or future date)
 */
router.get('/available-trips', (req, res) => {
  try {
    const date = req.query.date || getTomorrowString();
    const today = getTodayString();
    const todayDate = new Date(`${today}T00:00:00`);
    const latestDate = new Date(todayDate);
    latestDate.setDate(latestDate.getDate() + getMaxAdvanceBookingDays());
    const latestDateString = `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, '0')}-${String(latestDate.getDate()).padStart(2, '0')}`;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > latestDateString) {
      return res.status(400).json({
        success: false,
        message: `يمكن استعراض الرحلات من اليوم وحتى ${getMaxAdvanceBookingDays()} أيام مقدماً فقط.`,
      });
    }

    const trips = queryAll(
      `SELECT 
        t.id, t.trip_code, t.date, t.departure_time, t.capacity, t.booked_seats, t.status,
        (t.capacity - t.booked_seats) as available_seats,
        r.id as route_id, r.name as route_name, r.start_location, r.end_location,
        v.vehicle_number, v.plate_number, v.type as vehicle_type,
        u_drv.full_name as driver_name
       FROM trips t
       JOIN routes r ON t.route_id = r.id
       JOIN vehicles v ON t.vehicle_id = v.id
       JOIN drivers d ON t.driver_id = d.id
       JOIN users u_drv ON d.user_id = u_drv.id
       WHERE t.date = ? AND t.status = 'SCHEDULED'
       ORDER BY t.departure_time ASC`,
      [date]
    );

    const existingBooking = queryOne(
      `SELECT b.id as booking_id, b.booking_code, t.trip_code, t.departure_time, r.name as route_name, v.vehicle_number
       FROM bookings b
       JOIN trips t ON t.id = b.trip_id
       JOIN routes r ON r.id = t.route_id
       JOIN vehicles v ON v.id = t.vehicle_id
       WHERE b.student_id = ? AND b.date = ? AND b.status = 'CONFIRMED'`,
      [req.student.student_id, date]
    );

    // Fetch pickup points for each route
    const bookingCutoffMin = Math.max(0, Number.parseInt(getSetting('booking_cutoff_min', '30'), 10) || 0);
    const tripsWithinBookingWindow = trips.filter((trip) =>
      getMinutesUntilDeparture(trip.date, trip.departure_time) > bookingCutoffMin
    );

    const tripsWithPickups = tripsWithinBookingWindow.map((trip) => {
      const pickups = queryAll(
        `SELECT id, name, sequence_order, expected_time_offset_min, landmark
         FROM pickup_points
         WHERE route_id = ?
         ORDER BY sequence_order ASC`,
        [trip.route_id]
      );
      return {
        ...trip,
        is_full: trip.available_seats <= 0,
        pickups,
      };
    });

    return res.json({
      success: true,
      date,
      formatted_date: formatArabicDate(date),
      max_booking_date: latestDateString,
      existing_booking: existingBooking || null,
      trips: tripsWithPickups,
    });
  } catch (error) {
    console.error('Available trips error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل الرحلات المتاحة.' });
  }
});

/**
 * POST /api/student/book
 * Book a trip
 */
router.post('/book', (req, res) => {
  try {
    const student = req.student;
    const tripId = Number.parseInt(req.body.trip_id, 10);
    const pickupPointId = Number.parseInt(req.body.pickup_point_id, 10);

    if (!Number.isInteger(tripId) || tripId <= 0 || !Number.isInteger(pickupPointId) || pickupPointId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'يرجى اختيار الرحلة ونقطة الركوب.',
      });
    }

    const trip = queryOne(
      'SELECT id, trip_code, date, departure_time, route_id, capacity, booked_seats, status FROM trips WHERE id = ?',
      [tripId]
    );

    if (!trip) {
      return res.status(404).json({ success: false, message: 'الرحلة غير موجودة.' });
    }

    if (trip.status !== 'SCHEDULED') {
      return res.status(400).json({ success: false, message: 'الرحلة غير متاحة للحجز حالياً.' });
    }

    const pickupPoint = queryOne('SELECT id FROM pickup_points WHERE id = ? AND route_id = ?', [pickupPointId, trip.route_id]);
    if (!pickupPoint) {
      return res.status(400).json({ success: false, message: 'نقطة الركوب لا تتبع خط الرحلة المختار.' });
    }

    const today = getTodayString();
    const todayDate = new Date(`${today}T00:00:00`);
    const latestDate = new Date(todayDate);
    latestDate.setDate(latestDate.getDate() + getMaxAdvanceBookingDays());
    const latestDateString = `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, '0')}-${String(latestDate.getDate()).padStart(2, '0')}`;
    if (trip.date < today || trip.date > latestDateString) {
      return res.status(400).json({ success: false, message: 'موعد هذه الرحلة خارج فترة الحجز المسموح بها.' });
    }

    if (!isDateOpen(trip.date)) {
      return res.status(400).json({
        success: false,
        message: 'عذراً، تم إغلاق دورة هذا اليوم ولا يمكن إجراء حجوزات جديدة.',
      });
    }

    const bookingCutoffMin = Math.max(0, Number.parseInt(getSetting('booking_cutoff_min', '30'), 10) || 0);
    if (getMinutesUntilDeparture(trip.date, trip.departure_time) <= bookingCutoffMin) {
      return res.status(400).json({ success: false, message: 'انتهت مهلة الحجز لهذه الرحلة.' });
    }

    if (trip.booked_seats >= trip.capacity) {
      return res.status(400).json({
        success: false,
        message: 'عذراً، هذه الرحلة مكتملة العدد بالكامل (FULL). يرجى اختيار رحلة أخرى.',
      });
    }

    // Check if student already booked for this trip or on the same date
    const existing = queryOne(
      `SELECT id FROM bookings WHERE student_id = ? AND date = ? AND status = 'CONFIRMED'`,
      [student.student_id, trip.date]
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'لديك حجز مؤكد بالفعل في هذا التاريخ. لا يمكنك حجز أكثر من رحلة في نفس اليوم.',
      });
    }

    // Generate Booking Code & QR token
    const randomCode = crypto.randomInt(100000, 1000000);
    const booking_code = `STU-${trip.date.replace(/-/g, '')}-${randomCode}`;
    const qr_code_token = crypto.randomBytes(32).toString('base64url');

    // Execute booking atomically
    const newBooking = transaction(({ run, queryOne }) => {
      const bRes = run(
        `INSERT INTO bookings (booking_code, student_id, trip_id, date, pickup_point_id, qr_code_token, status)
         VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED')`,
        [booking_code, student.student_id, trip.id, trip.date, pickupPointId, qr_code_token]
      );

      // Increment booked seats
      run('UPDATE trips SET booked_seats = booked_seats + 1 WHERE id = ?', [trip.id]);

      return queryOne('SELECT * FROM bookings WHERE id = ?', [bRes.lastInsertRowid]);
    });

    return res.status(201).json({
      success: true,
      message: 'تم تأكيد حجزك بنجاح! تم إنشاء كود الحجز ورمز QR الخاص بك.',
      booking: newBooking,
    });
  } catch (error) {
    console.error('Booking error:', error);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء إجراء الحجز.' });
  }
});

/**
 * POST /api/student/cancel-booking
 * Cancel an existing booking
 */
router.post('/cancel-booking', (req, res) => {
  try {
    const student = req.student;
    const booking_id = Number.parseInt(req.body.booking_id, 10);

    if (!Number.isInteger(booking_id) || booking_id <= 0) {
      return res.status(400).json({ success: false, message: 'معرف الحجز مطلوب.' });
    }

    const booking = queryOne(
      `SELECT b.id, b.trip_id, b.date, b.status, t.departure_time
       FROM bookings b JOIN trips t ON t.id = b.trip_id
       WHERE b.id = ? AND b.student_id = ?`,
      [booking_id, student.student_id]
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'الحجز غير موجود.' });
    }

    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({ success: false, message: 'الحجز ملغى بالفعل.' });
    }

    if (getSetting('allow_cancellation', 'true') !== 'true') {
      return res.status(400).json({ success: false, message: 'إلغاء الحجوزات غير متاح حالياً. تواصل مع الإدارة للمساعدة.' });
    }

    const cancellationCutoffMin = Math.max(0, Number.parseInt(getSetting('cancellation_cutoff_min', '60'), 10) || 0);
    if (getMinutesUntilDeparture(booking.date, booking.departure_time) <= cancellationCutoffMin) {
      return res.status(400).json({ success: false, message: `لا يمكن إلغاء الحجز قبل موعد الرحلة بأقل من ${cancellationCutoffMin} دقيقة.` });
    }

    if (!isDateOpen(booking.date)) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إلغاء الحجز لأن دورة هذا اليوم مغلقة.',
      });
    }

    // Check if attendance already recorded
    const attendance = queryOne('SELECT id FROM attendances WHERE booking_id = ?', [booking.id]);
    if (attendance) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إلغاء الحجز بعد تسجيل الحضور.',
      });
    }

    transaction(({ run }) => {
      run(`UPDATE bookings SET status = 'CANCELLED' WHERE id = ?`, [booking.id]);
      run('UPDATE trips SET booked_seats = MAX(0, booked_seats - 1) WHERE id = ?', [booking.trip_id]);
    });

    return res.json({
      success: true,
      message: 'تم إلغاء الحجز بنجاح وإتاحة المقعد للطلاب الآخرين.',
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    return res.status(500).json({ success: false, message: 'فشل إلغاء الحجز.' });
  }
});

/**
 * GET /api/student/history
 * Full attendance and booking history for the logged-in student (strictly private)
 */
router.get('/history', (req, res) => {
  try {
    const student = req.student;

    const history = queryAll(
      `SELECT 
        b.id as booking_id, b.booking_code, b.date, b.status as booking_status,
        t.departure_time, t.trip_code, t.status as trip_status,
        r.name as route_name,
        p.name as pickup_name,
        v.vehicle_number,
        a.status as attendance_status, a.method as attendance_method, a.checked_in_at
       FROM bookings b
       JOIN trips t ON b.trip_id = t.id
       JOIN routes r ON t.route_id = r.id
       JOIN pickup_points p ON b.pickup_point_id = p.id
       JOIN vehicles v ON t.vehicle_id = v.id
       LEFT JOIN attendances a ON a.booking_id = b.id
       WHERE b.student_id = ?
       ORDER BY b.date DESC, t.departure_time DESC`,
      [student.student_id]
    );

    // Summary metrics
    const activeHistory = history.filter((item) => item.booking_status !== 'CANCELLED');
    const totalBookings = activeHistory.length;
    const attendedCount = history.filter((h) => h.attendance_status === 'PRESENT').length;
    const finalizedHistory = activeHistory.filter((item) => item.attendance_status || item.date < getTodayString() || item.trip_status === 'COMPLETED' || item.trip_status === 'CANCELLED' || !isDateOpen(item.date));
    const absentCount = finalizedHistory.filter((item) => !item.attendance_status).length;
    const cancellationAllowed = getSetting('allow_cancellation', 'true') === 'true';
    const cancellationCutoffMin = Math.max(0, Number.parseInt(getSetting('cancellation_cutoff_min', '60'), 10) || 0);

    return res.json({
      success: true,
      summary: {
        total_bookings: totalBookings,
        attended_count: attendedCount,
        absent_count: absentCount,
        attendance_percentage: finalizedHistory.length > 0 ? Math.round((attendedCount / finalizedHistory.length) * 100) : 0,
      },
      history: history.map((item) => ({
        ...item,
        formatted_date: formatArabicDate(item.date),
        can_cancel: cancellationAllowed
          && item.booking_status === 'CONFIRMED'
          && !item.attendance_status
          && item.trip_status === 'SCHEDULED'
          && isDateOpen(item.date)
          && getMinutesUntilDeparture(item.date, item.departure_time) > cancellationCutoffMin,
        attendance_label: item.attendance_status === 'PRESENT'
          ? 'PRESENT'
          : item.attendance_status === 'EXCUSED'
          ? 'EXCUSED'
          : item.booking_status === 'CANCELLED'
          ? 'CANCELLED'
          : item.date < getTodayString() || item.trip_status === 'COMPLETED' || item.trip_status === 'CANCELLED' || !isDateOpen(item.date)
          ? 'ABSENT'
          : 'PENDING',
      })),
    });
  } catch (error) {
    console.error('Student history error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل سجل الرحلات.' });
  }
});

/**
 * GET /api/student/routes
 * List all active routes and pickup points for registration or selection
 */
router.get('/routes', (req, res) => {
  try {
    const routes = queryAll('SELECT * FROM routes WHERE is_active = 1 ORDER BY name ASC');
    const fullRoutes = routes.map((r) => {
      const pickups = queryAll(
        'SELECT * FROM pickup_points WHERE route_id = ? ORDER BY sequence_order ASC',
        [r.id]
      );
      return { ...r, pickup_points: pickups };
    });
    return res.json({ success: true, routes: fullRoutes });
  } catch (error) {
    console.error('Routes error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل الخطوط.' });
  }
});

module.exports = router;
