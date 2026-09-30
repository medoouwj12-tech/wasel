const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { queryOne, queryAll, run, transaction } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  getTodayString,
  getTomorrowString,
  getDateStats,
  listAllCycles,
  closeDay,
  openDay,
} = require('../services/dailyOperationsService');

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole('ADMIN'));

function timeToMinutes(time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function findScheduleConflict({ date, departureTime, duration, vehicleId, driverId, excludeTripId = null }) {
  const start = timeToMinutes(departureTime);
  if (start === null) return 'صيغة وقت انطلاق الرحلة غير صحيحة.';
  const scheduled = queryAll(
    `SELECT t.id, t.departure_time, t.vehicle_id, t.driver_id, r.estimated_duration_min
     FROM trips t JOIN routes r ON r.id = t.route_id
     WHERE t.date = ? AND t.status IN ('SCHEDULED', 'IN_TRANSIT') AND (? IS NULL OR t.id != ?)`,
    [date, excludeTripId, excludeTripId]
  );
  const conflict = scheduled.find((trip) => {
    if (trip.vehicle_id !== vehicleId && trip.driver_id !== driverId) return false;
    const existingStart = timeToMinutes(trip.departure_time);
    if (existingStart === null) return false;
    const existingDuration = Math.max(1, Number(trip.estimated_duration_min) || 45);
    return start < existingStart + existingDuration && existingStart < start + duration;
  });
  return conflict ? 'يوجد تعارض زمني للمركبة أو السائق في رحلة أخرى.' : null;
}

/**
 * GET /api/admin/overview
 * Dashboard KPI cards and high-level analytics
 */
router.get('/overview', (req, res) => {
  try {
    const date = req.query.date || getTodayString();
    const stats = getDateStats(date);

    const totalStudents = queryOne(
      "SELECT COUNT(id) as count FROM users WHERE role = 'STUDENT' AND is_active = 1"
    )?.count || 0;

    const availableVehicles = queryOne(
      "SELECT COUNT(id) as count FROM vehicles WHERE status IN ('AVAILABLE', 'ASSIGNED')"
    )?.count || 0;

    const activeDrivers = queryOne(
      "SELECT COUNT(d.id) as count FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.status = 'ACTIVE' AND u.is_active = 1"
    )?.count || 0;

    const recentBookings = queryAll(
      `SELECT 
        b.booking_code, b.created_at,
        u.full_name as student_name,
        r.name as route_name,
        v.vehicle_number,
        a.status as attendance_status, a.checked_in_at
       FROM bookings b
       JOIN students s ON b.student_id = s.id
       JOIN users u ON s.user_id = u.id
       JOIN trips t ON b.trip_id = t.id
       JOIN routes r ON t.route_id = r.id
       JOIN vehicles v ON t.vehicle_id = v.id
       LEFT JOIN attendances a ON a.booking_id = b.id
       WHERE b.date = ?
       ORDER BY b.id DESC
       LIMIT 10`,
      [date]
    );

    return res.json({
      success: true,
      data: {
        date,
        day_status: stats.status,
        total_students: totalStudents,
        today_trips: stats.total_trips,
        today_bookings: stats.total_booked,
        present_count: stats.present_count,
        absent_count: stats.absent_count,
        pending_count: stats.pending_count,
        attendance_rate: stats.attendance_rate,
        available_vehicles: availableVehicles,
        active_drivers: activeDrivers,
        recent_bookings: recentBookings,
      },
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل بيانات لوحة التحكم.' });
  }
});

/**
 * GET /api/admin/daily-operations
 * List all daily cycles with statistics
 */
router.get('/daily-operations', (req, res) => {
  try {
    const cycles = listAllCycles();
    return res.json({ success: true, cycles });
  } catch (error) {
    console.error('Daily operations list error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل سجل الأيام.' });
  }
});

/**
 * POST /api/admin/daily-operations/close
 * Close a specific daily cycle
 */
router.post('/daily-operations/close', (req, res) => {
  try {
    const { date, notes } = req.body;
    if (!date) {
      return res.status(400).json({ success: false, message: 'التاريخ مطلوب.' });
    }

    const result = closeDay(date, req.user.id, notes);
    return res.json(result);
  } catch (error) {
    console.error('Close day error:', error);
    return res.status(500).json({ success: false, message: 'فشل إغلاق دورة اليوم.' });
  }
});

/**
 * POST /api/admin/daily-operations/open
 * Open or reopen a specific daily cycle
 */
router.post('/daily-operations/open', (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ success: false, message: 'التاريخ مطلوب.' });
    }

    const result = openDay(date);
    return res.json(result);
  } catch (error) {
    console.error('Open day error:', error);
    return res.status(500).json({ success: false, message: 'فشل فتح دورة اليوم.' });
  }
});

/* =========================================================================
   STUDENTS MANAGEMENT
   ========================================================================= */

/**
 * GET /api/admin/students
 * List and search students
 */
router.get('/students', (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;

    let sql = `
      SELECT 
        s.id as student_id, s.student_code, s.emergency_phone, s.institution, s.grade_level, s.default_pickup_id,
        u.id as user_id, u.full_name, u.phone, u.email, u.is_active, u.created_at,
        p.name as default_pickup_name,
        (SELECT COUNT(b.id) FROM bookings b WHERE b.student_id = s.id AND b.status != 'CANCELLED') as total_bookings,
        (SELECT COUNT(a.id) FROM attendances a WHERE a.student_id = s.id AND a.status = 'PRESENT') as attended_count
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN pickup_points p ON s.default_pickup_id = p.id
    `;

    const params = [];
    if (search) {
      sql += ' WHERE (u.full_name LIKE ? OR u.phone LIKE ? OR s.student_code LIKE ?)';
      params.push(search, search, search);
    }

    sql += ' ORDER BY s.id DESC';

    const students = queryAll(sql, params);

    const enriched = students.map((s) => {
      const rate = s.total_bookings > 0 ? Math.round((s.attended_count / s.total_bookings) * 100) : 0;
      return {
        ...s,
        absent_count: Math.max(0, s.total_bookings - s.attended_count),
        attendance_rate: rate,
      };
    });

    return res.json({ success: true, students: enriched });
  } catch (error) {
    console.error('Admin students list error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل بيانات الطلاب.' });
  }
});

/**
 * POST /api/admin/students
 * Admin manually creates a student
 */
router.post('/students', async (req, res) => {
  try {
    const { full_name, phone, email, password, default_pickup_id, emergency_phone, institution, grade_level } = req.body;

    if (!full_name || !phone || !password) {
      return res.status(400).json({ success: false, message: 'الاسم ورقم الهاتف وكلمة المرور مطلوبة.' });
    }

    const existing = queryOne('SELECT id FROM users WHERE phone = ?', [phone.trim()]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'رقم الهاتف مسجل بالفعل لطالب آخر.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const currentYear = new Date().getFullYear();
    const student_code = `STU-${currentYear}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newStudent = transaction(({ run, queryOne }) => {
      const uRes = run(
        `INSERT INTO users (full_name, phone, email, password_hash, role)
         VALUES (?, ?, ?, ?, 'STUDENT')`,
        [full_name.trim(), phone.trim(), email ? email.trim() : null, password_hash]
      );
      const userId = uRes.lastInsertRowid;

      const sRes = run(
        `INSERT INTO students (user_id, student_code, default_pickup_id, emergency_phone, institution, grade_level)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, student_code, default_pickup_id || null, emergency_phone || null, institution || null, grade_level || null]
      );

      return { userId, studentId: sRes.lastInsertRowid, student_code };
    });

    return res.status(201).json({
      success: true,
      message: 'تم إضافة الطالب بنجاح.',
      student: newStudent,
    });
  } catch (error) {
    console.error('Admin create student error:', error);
    return res.status(500).json({ success: false, message: 'فشل إضافة الطالب.' });
  }
});

/**
 * PUT /api/admin/students/:id
 * Admin edits student details
 */
router.put('/students/:id', async (req, res) => {
  try {
    const studentId = req.params.id;
    const { full_name, phone, email, default_pickup_id, emergency_phone, institution, grade_level, password } = req.body;

    const student = queryOne('SELECT user_id FROM students WHERE id = ?', [studentId]);
    if (!student) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود.' });
    }

    // Check phone uniqueness if changed
    if (phone) {
      const existing = queryOne('SELECT id FROM users WHERE phone = ? AND id != ?', [phone.trim(), student.user_id]);
      if (existing) {
        return res.status(409).json({ success: false, message: 'رقم الهاتف مستخدم لحساب آخر.' });
      }
    }

    transaction(({ run }) => {
      if (full_name || phone || email !== undefined) {
        run(
          `UPDATE users 
           SET full_name = COALESCE(?, full_name),
               phone = COALESCE(?, phone),
               email = COALESCE(?, email),
               updated_at = datetime('now', 'localtime')
           WHERE id = ?`,
          [full_name ? full_name.trim() : null, phone ? phone.trim() : null, email !== undefined ? (email ? email.trim() : null) : null, student.user_id]
        );
      }

      if (password && password.length >= 6) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, student.user_id]);
      }

      run(
        `UPDATE students 
         SET default_pickup_id = ?,
             emergency_phone = ?,
             institution = ?,
             grade_level = ?
         WHERE id = ?`,
        [
          default_pickup_id || null,
          emergency_phone ? emergency_phone.trim() : null,
          institution ? institution.trim() : null,
          grade_level ? grade_level.trim() : null,
          studentId,
        ]
      );
    });

    return res.json({ success: true, message: 'تم تحديث بيانات الطالب بنجاح.' });
  } catch (error) {
    console.error('Update student error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحديث بيانات الطالب.' });
  }
});

/**
 * DELETE /api/admin/students/:id
 * Admin deletes a student and cascade removes their user record
 */
router.delete('/students/:id', (req, res) => {
  try {
    const studentId = req.params.id;
    const student = queryOne('SELECT user_id FROM students WHERE id = ?', [studentId]);
    if (!student) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود.' });
    }

    run('DELETE FROM users WHERE id = ?', [student.user_id]);
    return res.json({ success: true, message: 'تم حذف حساب الطالب وكافة سجلاته بنجاح.' });
  } catch (error) {
    console.error('Delete student error:', error);
    return res.status(500).json({ success: false, message: 'فشل حذف الطالب.' });
  }
});

/**
 * PATCH /api/admin/students/:id/status
 * Toggle student active status
 */
router.patch('/students/:id/status', (req, res) => {
  try {
    const studentId = req.params.id;
    const student = queryOne('SELECT user_id FROM students WHERE id = ?', [studentId]);
    if (!student) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود.' });
    }

    const user = queryOne('SELECT is_active FROM users WHERE id = ?', [student.user_id]);
    const newStatus = user.is_active === 1 ? 0 : 1;

    run('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, student.user_id]);

    return res.json({
      success: true,
      message: newStatus === 1 ? 'تم تفعيل حساب الطالب بنجاح.' : 'تم تعطيل حساب الطالب.',
      is_active: newStatus,
    });
  } catch (error) {
    console.error('Student toggle status error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحديث حالة الطالب.' });
  }
});

/**
 * GET /api/admin/students/:id/history
 * View full history of bookings and attendances for an individual student
 */
router.get('/students/:id/history', (req, res) => {
  try {
    const studentId = req.params.id;
    const student = queryOne(
      `SELECT s.*, u.full_name, u.phone, u.email, u.is_active
       FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
      [studentId]
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود.' });
    }

    const logs = queryAll(
      `SELECT 
        b.booking_code, b.date, b.status as booking_status,
        t.departure_time, t.trip_code,
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
      [studentId]
    );

    return res.json({ success: true, student, logs });
  } catch (error) {
    console.error('Student history error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل سجل الطالب.' });
  }
});

/* =========================================================================
   TRIPS MANAGEMENT
   ========================================================================= */

/**
 * GET /api/admin/trips
 * List trips for a given date
 */
router.get('/trips', (req, res) => {
  try {
    const date = req.query.date || getTodayString();

    const trips = queryAll(
      `SELECT 
        t.*,
        r.name as route_name, r.start_location, r.end_location, r.direction,
        v.vehicle_number, v.plate_number, v.type as vehicle_type,
        u_drv.full_name as driver_name, u_drv.phone as driver_phone,
        (SELECT COUNT(a.id) FROM attendances a WHERE a.trip_id = t.id AND a.status = 'PRESENT') as present_count
       FROM trips t
       JOIN routes r ON t.route_id = r.id
       JOIN vehicles v ON t.vehicle_id = v.id
       JOIN drivers d ON t.driver_id = d.id
       JOIN users u_drv ON d.user_id = u_drv.id
       WHERE t.date = ?
       ORDER BY t.departure_time ASC`,
      [date]
    );

    const enriched = trips.map((t) => {
      const finalized = ['COMPLETED', 'CANCELLED'].includes(t.status) || t.date < getTodayString() || !isDateOpen(t.date);
      const absent = finalized ? Math.max(0, t.booked_seats - t.present_count) : 0;
      return {
        ...t,
        available_seats: Math.max(0, t.capacity - t.booked_seats),
        absent_count: absent,
        pending_count: Math.max(0, t.booked_seats - t.present_count - absent),
        is_full: t.booked_seats >= t.capacity,
      };
    });

    return res.json({ success: true, date, trips: enriched });
  } catch (error) {
    console.error('Admin trips error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل الرحلات.' });
  }
});

/**
 * POST /api/admin/trips
 * Create new trip
 */
router.post('/trips', (req, res) => {
  try {
    const { date, departure_time, route_id, vehicle_id, driver_id, capacity } = req.body;

    if (!date || !departure_time || !route_id || !vehicle_id || !driver_id) {
      return res.status(400).json({ success: false, message: 'يرجى استيفاء جميع بيانات الرحلة.' });
    }

    const routeId = Number.parseInt(route_id, 10);
    const vehicleId = Number.parseInt(vehicle_id, 10);
    const driverId = Number.parseInt(driver_id, 10);
    if (!isValidDate(date) || timeToMinutes(departure_time) === null || ![routeId, vehicleId, driverId].every((id) => Number.isInteger(id) && id > 0)) {
      return res.status(400).json({ success: false, message: 'التاريخ أو الوقت أو بيانات الرحلة غير صالحة.' });
    }
    if (!isDateOpen(date)) return res.status(400).json({ success: false, message: 'يجب فتح دورة يوم الرحلة قبل جدولة رحلة جديدة.' });

    const route = queryOne('SELECT id, estimated_duration_min FROM routes WHERE id = ? AND is_active = 1', [routeId]);
    const vehicle = queryOne('SELECT id, capacity, driver_id, status FROM vehicles WHERE id = ?', [vehicleId]);
    const driver = queryOne("SELECT d.id, d.status, u.is_active FROM drivers d JOIN users u ON u.id = d.user_id WHERE d.id = ?", [driverId]);
    if (!route) return res.status(400).json({ success: false, message: 'خط السير غير موجود أو غير نشط.' });
    if (!vehicle || !['AVAILABLE', 'ASSIGNED'].includes(vehicle.status)) return res.status(400).json({ success: false, message: 'المركبة غير متاحة للتشغيل.' });
    if (vehicle.driver_id && vehicle.driver_id !== driverId) return res.status(400).json({ success: false, message: 'السائق المختار لا يطابق السائق المسجل على المركبة.' });
    if (!driver || driver.status !== 'ACTIVE' || driver.is_active !== 1) return res.status(400).json({ success: false, message: 'السائق غير نشط.' });

    const tripCapacity = capacity === undefined || capacity === '' ? vehicle.capacity : Number(capacity);
    if (!Number.isInteger(tripCapacity) || tripCapacity < 1 || tripCapacity > vehicle.capacity) {
      return res.status(400).json({ success: false, message: `سعة الرحلة يجب أن تكون بين 1 و${vehicle.capacity} مقعداً.` });
    }
    const conflict = findScheduleConflict({
      date,
      departureTime: departure_time,
      duration: Math.max(1, Number(route.estimated_duration_min) || 45),
      vehicleId,
      driverId,
    });
    if (conflict) return res.status(409).json({ success: false, message: conflict });

    const tripCode = `TRP-${date.replace(/-/g, '')}-${crypto.randomInt(100000, 1000000)}`;

    const resTrip = run(
      `INSERT INTO trips (trip_code, date, departure_time, route_id, vehicle_id, driver_id, capacity, booked_seats, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'SCHEDULED')`,
      [tripCode, date, departure_time, routeId, vehicleId, driverId, tripCapacity]
    );

    return res.status(201).json({
      success: true,
      message: 'تم إضافة الرحلة بنجاح.',
      trip_id: resTrip.lastInsertRowid,
    });
  } catch (error) {
    console.error('Create trip error:', error);
    return res.status(500).json({ success: false, message: 'فشل إضافة الرحلة.' });
  }
});

/**
 * PUT /api/admin/trips/:id
 * Edit an existing trip
 */
router.put('/trips/:id', (req, res) => {
  try {
    const tripId = Number.parseInt(req.params.id, 10);
    const { departure_time, route_id, vehicle_id, driver_id, capacity } = req.body;

    if (!Number.isInteger(tripId) || tripId <= 0) return res.status(400).json({ success: false, message: 'معرف الرحلة غير صالح.' });
    const existingTrip = queryOne('SELECT id, date, status, booked_seats, route_id, vehicle_id, driver_id, capacity FROM trips WHERE id = ?', [tripId]);
    if (!existingTrip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة.' });
    if (existingTrip.status !== 'SCHEDULED') return res.status(400).json({ success: false, message: 'لا يمكن تعديل رحلة بدأت أو أُغلقت.' });
    if (!isDateOpen(existingTrip.date)) return res.status(400).json({ success: false, message: 'يجب فتح دورة يوم الرحلة قبل تعديلها.' });
    const resourceChanged = [
      ['route_id', route_id, existingTrip.route_id],
      ['vehicle_id', vehicle_id, existingTrip.vehicle_id],
      ['driver_id', driver_id, existingTrip.driver_id],
      ['capacity', capacity, existingTrip.capacity],
    ].some(([key, value, current]) => value !== undefined && value !== null && String(value) !== '' && Number(value) !== current);
    if (existingTrip.booked_seats > 0 && resourceChanged) {
      return res.status(409).json({ success: false, message: 'لا يمكن تغيير الخط أو المركبة أو السائق أو السعة بعد وجود حجوزات. عدّل الموعد فقط أو ألغِ الرحلة.' });
    }

    const nextRouteId = route_id ? Number.parseInt(route_id, 10) : existingTrip.route_id;
    const nextVehicleId = vehicle_id ? Number.parseInt(vehicle_id, 10) : existingTrip.vehicle_id;
    const nextDriverId = driver_id ? Number.parseInt(driver_id, 10) : existingTrip.driver_id;
    const nextCapacity = capacity === undefined || capacity === '' ? existingTrip.capacity : Number(capacity);
    const nextDepartureTime = departure_time || queryOne('SELECT departure_time FROM trips WHERE id = ?', [tripId]).departure_time;
    if (![nextRouteId, nextVehicleId, nextDriverId].every((id) => Number.isInteger(id) && id > 0) || timeToMinutes(nextDepartureTime) === null) {
      return res.status(400).json({ success: false, message: 'بيانات الرحلة غير صالحة.' });
    }

    const route = queryOne('SELECT id, estimated_duration_min FROM routes WHERE id = ? AND is_active = 1', [nextRouteId]);
    const vehicle = queryOne('SELECT id, capacity, driver_id, status FROM vehicles WHERE id = ?', [nextVehicleId]);
    const driver = queryOne("SELECT d.id, d.status, u.is_active FROM drivers d JOIN users u ON u.id = d.user_id WHERE d.id = ?", [nextDriverId]);
    if (!route || !vehicle || !['AVAILABLE', 'ASSIGNED'].includes(vehicle.status) || !driver || driver.status !== 'ACTIVE' || driver.is_active !== 1) {
      return res.status(400).json({ success: false, message: 'خط السير أو المركبة أو السائق غير متاح.' });
    }
    if (vehicle.driver_id && vehicle.driver_id !== nextDriverId) return res.status(400).json({ success: false, message: 'السائق المختار لا يطابق السائق المسجل على المركبة.' });
    if (!Number.isInteger(nextCapacity) || nextCapacity < existingTrip.booked_seats || nextCapacity > vehicle.capacity) {
      return res.status(400).json({ success: false, message: `السعة يجب أن تكون بين الحجوزات الحالية وسعة المركبة (${vehicle.capacity}).` });
    }
    const conflict = findScheduleConflict({
      date: queryOne('SELECT date FROM trips WHERE id = ?', [tripId]).date,
      departureTime: nextDepartureTime,
      duration: Math.max(1, Number(route.estimated_duration_min) || 45),
      vehicleId: nextVehicleId,
      driverId: nextDriverId,
      excludeTripId: tripId,
    });
    if (conflict) return res.status(409).json({ success: false, message: conflict });

    run(
      `UPDATE trips 
       SET departure_time = COALESCE(?, departure_time),
           route_id = COALESCE(?, route_id),
           vehicle_id = COALESCE(?, vehicle_id),
           driver_id = COALESCE(?, driver_id),
           capacity = COALESCE(?, capacity)
       WHERE id = ?`,
      [
        departure_time || null,
        route_id ? parseInt(route_id, 10) : null,
        vehicle_id ? parseInt(vehicle_id, 10) : null,
        driver_id ? parseInt(driver_id, 10) : null,
        capacity ? parseInt(capacity, 10) : null,
        tripId,
      ]
    );

    return res.json({ success: true, message: 'تم تعديل بيانات الرحلة بنجاح.' });
  } catch (error) {
    console.error('Edit trip error:', error);
    return res.status(500).json({ success: false, message: 'فشل تعديل الرحلة.' });
  }
});

/**
 * Cancel a scheduled trip without deleting its booking history.
 */
router.post('/trips/:id/cancel', (req, res) => {
  try {
    const tripId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(tripId) || tripId <= 0) return res.status(400).json({ success: false, message: 'معرف الرحلة غير صالح.' });
    const trip = queryOne('SELECT id, status FROM trips WHERE id = ?', [tripId]);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة.' });
    if (trip.status !== 'SCHEDULED') return res.status(400).json({ success: false, message: 'يمكن إلغاء الرحلات المجدولة فقط. الرحلة التي بدأت لا يمكن إلغاؤها.' });
    transaction(({ run }) => {
      run("UPDATE trips SET status = 'CANCELLED' WHERE id = ?", [tripId]);
      run("UPDATE bookings SET status = 'CANCELLED' WHERE trip_id = ? AND status = 'CONFIRMED'", [tripId]);
    });
    return res.json({ success: true, message: 'تم إلغاء الرحلة وحفظ سجلها.' });
  } catch (error) {
    console.error('Cancel trip error:', error);
    return res.status(500).json({ success: false, message: 'فشل إلغاء الرحلة.' });
  }
});

router.delete('/trips/:id', (req, res) => {
  try {
    const tripId = Number.parseInt(req.params.id, 10);
    const trip = Number.isInteger(tripId) && tripId > 0
      ? queryOne('SELECT id, status FROM trips WHERE id = ?', [tripId])
      : null;
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة.' });
    if (trip.status !== 'SCHEDULED') return res.status(400).json({ success: false, message: 'لا يمكن حذف رحلة بدأت أو اكتملت.' });
    const bookings = queryOne('SELECT COUNT(id) as count FROM bookings WHERE trip_id = ?', [tripId])?.count || 0;
    if (bookings > 0) return res.status(409).json({ success: false, message: 'تحتوي الرحلة على حجوزات. ألغِ الرحلة للحفاظ على سجل الركاب.' });
    run('DELETE FROM trips WHERE id = ?', [tripId]);
    return res.json({ success: true, message: 'تم حذف الرحلة المجدولة.' });
  } catch (error) {
    console.error('Delete trip error:', error);
    return res.status(500).json({ success: false, message: 'فشل حذف الرحلة.' });
  }
});

/* =========================================================================
   VEHICLES MANAGEMENT
   ========================================================================= */

/**
 * GET /api/admin/vehicles
 */
router.get('/vehicles', (req, res) => {
  try {
    const vehicles = queryAll(
      `SELECT v.*, u.full_name as driver_name, u.phone as driver_phone
       FROM vehicles v
       LEFT JOIN drivers d ON v.driver_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       ORDER BY v.id DESC`
    );
    return res.json({ success: true, vehicles });
  } catch (error) {
    console.error('Vehicles error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل المركبات.' });
  }
});

/**
 * POST /api/admin/vehicles
 */
router.post('/vehicles', (req, res) => {
  try {
    const { vehicle_number, plate_number, type, capacity, driver_id, status, notes } = req.body;
    if (!vehicle_number || !plate_number || !capacity) {
      return res.status(400).json({ success: false, message: 'بيانات المركبة الأساسية مطلوبة.' });
    }

    run(
      `INSERT INTO vehicles (vehicle_number, plate_number, type, capacity, driver_id, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        vehicle_number.trim(),
        plate_number.trim(),
        type || 'BUS',
        parseInt(capacity, 10),
        driver_id || null,
        status || 'AVAILABLE',
        notes || null,
      ]
    );

    return res.status(201).json({ success: true, message: 'تم إضافة المركبة بنجاح.' });
  } catch (error) {
    console.error('Create vehicle error:', error);
    return res.status(500).json({ success: false, message: 'فشل إضافة المركبة.' });
  }
});

/**
 * PUT /api/admin/vehicles/:id
 * Edit an existing vehicle
 */
router.put('/vehicles/:id', (req, res) => {
  try {
    const vehicleId = req.params.id;
    const { vehicle_number, plate_number, type, capacity, driver_id, status, notes } = req.body;

    run(
      `UPDATE vehicles 
       SET vehicle_number = COALESCE(?, vehicle_number),
           plate_number = COALESCE(?, plate_number),
           type = COALESCE(?, type),
           capacity = COALESCE(?, capacity),
           driver_id = ?,
           status = COALESCE(?, status),
           notes = ?
       WHERE id = ?`,
      [
        vehicle_number ? vehicle_number.trim() : null,
        plate_number ? plate_number.trim() : null,
        type || null,
        capacity ? parseInt(capacity, 10) : null,
        driver_id || null,
        status || null,
        notes !== undefined ? notes : null,
        vehicleId,
      ]
    );

    return res.json({ success: true, message: 'تم تعديل بيانات المركبة بنجاح.' });
  } catch (error) {
    console.error('Update vehicle error:', error);
    return res.status(500).json({ success: false, message: 'فشل تعديل المركبة.' });
  }
});

/**
 * DELETE /api/admin/vehicles/:id
 */
router.delete('/vehicles/:id', (req, res) => {
  try {
    const vehicleId = req.params.id;
    run('DELETE FROM vehicles WHERE id = ?', [vehicleId]);
    return res.json({ success: true, message: 'تم حذف المركبة بنجاح.' });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    return res.status(500).json({ success: false, message: 'فشل حذف المركبة.' });
  }
});

/* =========================================================================
   DRIVERS MANAGEMENT
   ========================================================================= */

/**
 * GET /api/admin/drivers
 */
router.get('/drivers', (req, res) => {
  try {
    const drivers = queryAll(
      `SELECT d.*, u.full_name, u.phone, u.email, u.is_active,
              v.id as vehicle_id, v.vehicle_number, v.plate_number
       FROM drivers d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN vehicles v ON v.driver_id = d.id
       ORDER BY d.id DESC`
    );
    return res.json({ success: true, drivers });
  } catch (error) {
    console.error('Drivers error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل السائقين.' });
  }
});

/**
 * POST /api/admin/drivers
 */
router.post('/drivers', async (req, res) => {
  try {
    const { full_name, phone, email, password, license_number, experience_years } = req.body;
    if (!full_name || !phone || !password) {
      return res.status(400).json({ success: false, message: 'بيانات السائق الأساسية مطلوبة.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    transaction(({ run }) => {
      const uRes = run(
        `INSERT INTO users (full_name, phone, email, password_hash, role)
         VALUES (?, ?, ?, ?, 'DRIVER')`,
        [full_name.trim(), phone.trim(), email || null, password_hash]
      );
      run(
        `INSERT INTO drivers (user_id, license_number, experience_years, status)
         VALUES (?, ?, ?, 'ACTIVE')`,
        [uRes.lastInsertRowid, license_number || null, experience_years || 0]
      );
    });

    return res.status(201).json({ success: true, message: 'تم إضافة السائق بنجاح.' });
  } catch (error) {
    console.error('Create driver error:', error);
    return res.status(500).json({ success: false, message: 'فشل إضافة السائق.' });
  }
});

/**
 * PUT /api/admin/drivers/:id
 * Edit driver details
 */
router.put('/drivers/:id', async (req, res) => {
  try {
    const driverId = req.params.id;
    const { full_name, phone, email, license_number, experience_years, status, password } = req.body;

    const driver = queryOne('SELECT user_id FROM drivers WHERE id = ?', [driverId]);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'السائق غير موجود.' });
    }

    // Check phone uniqueness
    if (phone) {
      const existing = queryOne('SELECT id FROM users WHERE phone = ? AND id != ?', [phone.trim(), driver.user_id]);
      if (existing) {
        return res.status(409).json({ success: false, message: 'رقم الهاتف مستخدم لحساب آخر.' });
      }
    }

    transaction(({ run }) => {
      if (full_name || phone || email !== undefined) {
        run(
          `UPDATE users 
           SET full_name = COALESCE(?, full_name),
               phone = COALESCE(?, phone),
               email = COALESCE(?, email),
               updated_at = datetime('now', 'localtime')
           WHERE id = ?`,
          [full_name ? full_name.trim() : null, phone ? phone.trim() : null, email !== undefined ? (email ? email.trim() : null) : null, driver.user_id]
        );
      }

      if (password && password.length >= 6) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, driver.user_id]);
      }

      run(
        `UPDATE drivers 
         SET license_number = COALESCE(?, license_number),
             experience_years = COALESCE(?, experience_years),
             status = COALESCE(?, status)
         WHERE id = ?`,
        [license_number || null, experience_years !== undefined ? parseInt(experience_years, 10) : null, status || null, driverId]
      );
    });

    return res.json({ success: true, message: 'تم تعديل بيانات السائق بنجاح.' });
  } catch (error) {
    console.error('Update driver error:', error);
    return res.status(500).json({ success: false, message: 'فشل تعديل بيانات السائق.' });
  }
});

/**
 * DELETE /api/admin/drivers/:id
 */
router.delete('/drivers/:id', (req, res) => {
  try {
    const driverId = req.params.id;
    const driver = queryOne('SELECT user_id FROM drivers WHERE id = ?', [driverId]);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'السائق غير موجود.' });
    }

    run('DELETE FROM users WHERE id = ?', [driver.user_id]);
    return res.json({ success: true, message: 'تم حذف السائق بنجاح.' });
  } catch (error) {
    console.error('Delete driver error:', error);
    return res.status(500).json({ success: false, message: 'فشل حذف السائق.' });
  }
});

/* =========================================================================
   ROUTES & DIRECTIONS MANAGEMENT
   ========================================================================= */

/**
 * GET /api/admin/routes
 */
router.get('/routes', (req, res) => {
  try {
    const routes = queryAll('SELECT * FROM routes ORDER BY id DESC');
    const enriched = routes.map((r) => {
      const points = queryAll('SELECT * FROM pickup_points WHERE route_id = ? ORDER BY sequence_order ASC', [r.id]);
      return { ...r, pickup_points: points };
    });
    return res.json({ success: true, routes: enriched });
  } catch (error) {
    console.error('Routes error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل خطوط السير.' });
  }
});

/**
 * POST /api/admin/routes
 */
router.post('/routes', (req, res) => {
  try {
    const { name, start_location, end_location, direction, estimated_duration_min, pickup_points } = req.body;
    if (!name || !start_location || !end_location) {
      return res.status(400).json({ success: false, message: 'اسم الخط ومحطات البداية والنهاية مطلوبة.' });
    }

    transaction(({ run }) => {
      const rRes = run(
        `INSERT INTO routes (name, start_location, end_location, direction, estimated_duration_min)
         VALUES (?, ?, ?, ?, ?)`,
        [name.trim(), start_location.trim(), end_location.trim(), direction || 'GO', estimated_duration_min || 45]
      );
      const routeId = rRes.lastInsertRowid;

      if (Array.isArray(pickup_points)) {
        pickup_points.forEach((p, idx) => {
          if (p.name && p.name.trim()) {
            run(
              `INSERT INTO pickup_points (route_id, name, sequence_order, expected_time_offset_min, landmark)
               VALUES (?, ?, ?, ?, ?)`,
              [routeId, p.name.trim(), idx + 1, p.expected_time_offset_min || 0, p.landmark || null]
            );
          }
        });
      }
    });

    return res.status(201).json({ success: true, message: 'تم إنشاء الخط ونقاط الركوب بنجاح.' });
  } catch (error) {
    console.error('Create route error:', error);
    return res.status(500).json({ success: false, message: 'فشل إنشاء الخط.' });
  }
});

/**
 * PUT /api/admin/routes/:id
 * Edit route details and direction
 */
router.put('/routes/:id', (req, res) => {
  try {
    const routeId = req.params.id;
    const { name, start_location, end_location, direction, estimated_duration_min, is_active } = req.body;

    run(
      `UPDATE routes 
       SET name = COALESCE(?, name),
           start_location = COALESCE(?, start_location),
           end_location = COALESCE(?, end_location),
           direction = COALESCE(?, direction),
           estimated_duration_min = COALESCE(?, estimated_duration_min),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        name ? name.trim() : null,
        start_location ? start_location.trim() : null,
        end_location ? end_location.trim() : null,
        direction || null,
        estimated_duration_min ? parseInt(estimated_duration_min, 10) : null,
        is_active !== undefined ? is_active : null,
        routeId,
      ]
    );

    return res.json({ success: true, message: 'تم تعديل بيانات الخط والاتجاه بنجاح.' });
  } catch (error) {
    console.error('Update route error:', error);
    return res.status(500).json({ success: false, message: 'فشل تعديل الخط.' });
  }
});

/**
 * DELETE /api/admin/routes/:id
 */
router.delete('/routes/:id', (req, res) => {
  try {
    const routeId = req.params.id;
    run('DELETE FROM routes WHERE id = ?', [routeId]);
    return res.json({ success: true, message: 'تم حذف الخط وكافة محطاته بنجاح.' });
  } catch (error) {
    console.error('Delete route error:', error);
    return res.status(500).json({ success: false, message: 'فشل حذف الخط.' });
  }
});

/**
 * POST /api/admin/routes/:id/pickup-points
 * Add a pickup point to a route
 */
router.post('/routes/:id/pickup-points', (req, res) => {
  try {
    const routeId = req.params.id;
    const { name, expected_time_offset_min, landmark } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'اسم محطة الركوب مطلوب.' });
    }

    const maxSeq = queryOne(
      'SELECT COALESCE(MAX(sequence_order), 0) as max_seq FROM pickup_points WHERE route_id = ?',
      [routeId]
    )?.max_seq || 0;

    const resPoint = run(
      `INSERT INTO pickup_points (route_id, name, sequence_order, expected_time_offset_min, landmark)
       VALUES (?, ?, ?, ?, ?)`,
      [routeId, name.trim(), maxSeq + 1, expected_time_offset_min || 0, landmark || null]
    );

    return res.status(201).json({
      success: true,
      message: 'تم إضافة محطة الركوب بنجاح.',
      point_id: resPoint.lastInsertRowid,
    });
  } catch (error) {
    console.error('Add pickup point error:', error);
    return res.status(500).json({ success: false, message: 'فشل إضافة محطة الركوب.' });
  }
});

/**
 * PUT /api/admin/pickup-points/:id
 * Edit pickup point
 */
router.put('/pickup-points/:id', (req, res) => {
  try {
    const pointId = req.params.id;
    const { name, sequence_order, expected_time_offset_min, landmark } = req.body;

    run(
      `UPDATE pickup_points 
       SET name = COALESCE(?, name),
           sequence_order = COALESCE(?, sequence_order),
           expected_time_offset_min = COALESCE(?, expected_time_offset_min),
           landmark = COALESCE(?, landmark)
       WHERE id = ?`,
      [
        name ? name.trim() : null,
        sequence_order ? parseInt(sequence_order, 10) : null,
        expected_time_offset_min !== undefined ? parseInt(expected_time_offset_min, 10) : null,
        landmark !== undefined ? landmark : null,
        pointId,
      ]
    );

    return res.json({ success: true, message: 'تم تعديل محطة الركوب بنجاح.' });
  } catch (error) {
    console.error('Update pickup point error:', error);
    return res.status(500).json({ success: false, message: 'فشل تعديل محطة الركوب.' });
  }
});

/**
 * DELETE /api/admin/pickup-points/:id
 */
router.delete('/pickup-points/:id', (req, res) => {
  try {
    const pointId = req.params.id;
    run('DELETE FROM pickup_points WHERE id = ?', [pointId]);
    return res.json({ success: true, message: 'تم حذف محطة الركوب بنجاح.' });
  } catch (error) {
    console.error('Delete pickup point error:', error);
    return res.status(500).json({ success: false, message: 'فشل حذف محطة الركوب.' });
  }
});

/* =========================================================================
   REPORTS & SETTINGS
   ========================================================================= */

/**
 * GET /api/admin/reports/attendance
 * Detailed report with date, route, and status filters
 */
router.get('/reports/attendance', (req, res) => {
  try {
    const { date, start_date, end_date, route_id, status } = req.query;

    let sql = `
      SELECT 
        b.booking_code, b.date, b.created_at as booked_at,
        u.full_name as student_name, u.phone as student_phone, s.student_code,
        t.trip_code, t.departure_time, t.status as trip_status,
        r.name as route_name,
        p.name as pickup_name,
        v.vehicle_number,
        u_drv.full_name as driver_name,
        a.id as attendance_id, a.status as attendance_status, a.method as attendance_method, a.checked_in_at,
        EXISTS (SELECT 1 FROM daily_operations op WHERE op.date = b.date AND op.status = 'CLOSED') as day_closed
      FROM bookings b
      JOIN students s ON b.student_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN trips t ON b.trip_id = t.id
      JOIN routes r ON t.route_id = r.id
      JOIN pickup_points p ON b.pickup_point_id = p.id
      JOIN vehicles v ON t.vehicle_id = v.id
      JOIN drivers d ON t.driver_id = d.id
      JOIN users u_drv ON d.user_id = u_drv.id
      LEFT JOIN attendances a ON a.booking_id = b.id
      WHERE b.status = 'CONFIRMED'
    `;

    const params = [];

    if (date) {
      sql += ' AND b.date = ?';
      params.push(date);
    } else if (start_date && end_date) {
      sql += ' AND b.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    if (route_id) {
      sql += ' AND t.route_id = ?';
      params.push(route_id);
    }

    if (status === 'PRESENT') {
      sql += " AND a.status = 'PRESENT'";
    } else if (status === 'ABSENT') {
      sql += " AND (a.status = 'ABSENT' OR (a.id IS NULL AND (b.date < ? OR t.status IN ('COMPLETED', 'CANCELLED') OR EXISTS (SELECT 1 FROM daily_operations op WHERE op.date = b.date AND op.status = 'CLOSED'))))";
      params.push(getTodayString());
    }

    sql += ' ORDER BY b.date DESC, t.departure_time DESC, u.full_name ASC';

    const records = queryAll(sql, params);

    return res.json({
      success: true,
      total_count: records.length,
      records: records.map((r) => {
        const isPresent = r.attendance_status === 'PRESENT';
        const isFinalized = r.date < getTodayString() || Boolean(r.day_closed) || r.trip_status === 'COMPLETED' || r.trip_status === 'CANCELLED';
        return {
          ...r,
          is_present: isPresent,
          attendance_label: isPresent ? 'PRESENT' : r.attendance_status === 'ABSENT' || isFinalized ? 'ABSENT' : r.attendance_status === 'EXCUSED' ? 'EXCUSED' : 'PENDING',
        };
      }),
    });
  } catch (error) {
    console.error('Reports error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل التقارير.' });
  }
});

/**
 * GET /api/admin/settings
 */
router.get('/settings', (req, res) => {
  try {
    const rows = queryAll('SELECT key, value FROM settings');
    const settingsObj = {};
    rows.forEach((r) => {
      settingsObj[r.key] = r.value;
    });
    return res.json({ success: true, settings: settingsObj });
  } catch (error) {
    console.error('Settings error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل الإعدادات.' });
  }
});

/**
 * PUT /api/admin/settings
 */
router.put('/settings', (req, res) => {
  try {
    const settings = req.body;
    const allowedKeys = new Set([
      'company_name', 'company_phone', 'company_email', 'auto_close_time',
      'booking_cutoff_min', 'allow_advance_booking_days', 'allow_cancellation',
      'cancellation_cutoff_min', 'allow_student_self_check_in',
    ]);
    const entries = Object.entries(settings || {});
    if (!entries.length || entries.some(([key]) => !allowedKeys.has(key))) {
      return res.status(400).json({ success: false, message: 'تتضمن الإعدادات حقولاً غير مدعومة.' });
    }

    const numericRanges = {
      booking_cutoff_min: [0, 180],
      allow_advance_booking_days: [1, 14],
      cancellation_cutoff_min: [0, 300],
    };
    for (const [key, value] of entries) {
      const textValue = String(value).trim();
      if (numericRanges[key]) {
        const number = Number(textValue);
        const [min, max] = numericRanges[key];
        if (!Number.isInteger(number) || number < min || number > max) {
          return res.status(400).json({ success: false, message: 'قيمة مدة أو فترة الحجز خارج النطاق المسموح.' });
        }
      } else if (['allow_cancellation', 'allow_student_self_check_in'].includes(key) && !['true', 'false'].includes(textValue)) {
        return res.status(400).json({ success: false, message: 'إحدى قيم التفعيل غير صالحة.' });
      } else if (key === 'auto_close_time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(textValue)) {
        return res.status(400).json({ success: false, message: 'وقت إغلاق اليوم غير صالح.' });
      } else if (key.startsWith('company_') && textValue.length > 160) {
        return res.status(400).json({ success: false, message: 'بيانات الشركة أطول من الحد المسموح.' });
      }
    }

    transaction(({ run }) => {
      for (const [key, value] of entries) {
        run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value).trim()]);
      }
    });
    return res.json({ success: true, message: 'تم حفظ إعدادات النظام بنجاح.' });
  } catch (error) {
    console.error('Save settings error:', error);
    return res.status(500).json({ success: false, message: 'فشل حفظ الإعدادات.' });
  }
});

module.exports = router;
