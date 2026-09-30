require('dotenv').config();

const bcrypt = require('bcryptjs');
const { db, run, queryOne } = require('./db');
const { initSchema } = require('./schema');
const { getTodayString } = require('../services/dailyOperationsService');

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo data seeding is disabled in production. Use npm run bootstrap:admin for the initial administrator account.');
  }
  console.log('--- Initializing Database Schema ---');
  initSchema();

  console.log('--- Checking Existing Data ---');
  const adminExists = queryOne("SELECT id FROM users WHERE role = 'ADMIN'");
  if (adminExists) {
    console.log('Database already has an admin user. Skipping destructive reset.');
    return;
  }

  console.log('--- Seeding Fresh Demonstration Data ---');

  const salt = await bcrypt.genSalt(10);
  const hashAdmin = await bcrypt.hash('admin123', salt);
  const hashDriver = await bcrypt.hash('driver123', salt);
  const hashStudent = await bcrypt.hash('student123', salt);

  // 1. Settings
  const settings = [
    ['company_name', 'شركة واصل لنقل الطلاب والجامعات'],
    ['company_phone', '01001234567'],
    ['company_email', 'info@wasel-transport.com'],
    ['allow_advance_booking_days', '3'],
    ['booking_cutoff_min', '30'],
    ['auto_close_time', '23:59'],
    ['allow_cancellation', 'true'],
    ['cancellation_cutoff_min', '60'],
    ['allow_student_self_check_in', 'false'],
  ];
  for (const [k, v] of settings) {
    run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, v]);
  }

  // 2. Admin User
  const adminRes = run(
    `INSERT INTO users (full_name, phone, email, password_hash, role)
     VALUES (?, ?, ?, ?, 'ADMIN')`,
    ['مدير النظام الرئيسي', '01000000000', 'admin@wasel.com', hashAdmin]
  );
  const adminId = adminRes.lastInsertRowid;

  // 3. Drivers
  const driver1User = run(
    `INSERT INTO users (full_name, phone, email, password_hash, role)
     VALUES (?, ?, ?, ?, 'DRIVER')`,
    ['كابتن أحمد محمود', '01111111111', 'ahmed.driver@wasel.com', hashDriver]
  );
  const driver1 = run(
    `INSERT INTO drivers (user_id, license_number, experience_years, status)
     VALUES (?, 'DL-55291-MNF', 8, 'ACTIVE')`,
    [driver1User.lastInsertRowid]
  );

  const driver2User = run(
    `INSERT INTO users (full_name, phone, email, password_hash, role)
     VALUES (?, ?, ?, ?, 'DRIVER')`,
    ['كابتن محمود علي', '01222222222', 'mahmoud.driver@wasel.com', hashDriver]
  );
  const driver2 = run(
    `INSERT INTO drivers (user_id, license_number, experience_years, status)
     VALUES (?, 'DL-77319-MNF', 12, 'ACTIVE')`,
    [driver2User.lastInsertRowid]
  );

  // 4. Vehicles
  const v1 = run(
    `INSERT INTO vehicles (vehicle_number, plate_number, type, capacity, driver_id, status, notes)
     VALUES (?, ?, 'BUS', 40, ?, 'AVAILABLE', ?)`,
    ['Bus #05', 'س ق د 9142', driver1.lastInsertRowid, 'أوتوبيس مرسيدس مكيف - خط شبين الجامعة']
  );

  const v2 = run(
    `INSERT INTO vehicles (vehicle_number, plate_number, type, capacity, driver_id, status, notes)
     VALUES (?, ?, 'BUS', 50, ?, 'AVAILABLE', ?)`,
    ['Bus #12', 'م ن ل 3589', driver2.lastInsertRowid, 'أوتوبيس كينج لونج - خط منوف']
  );

  const v3 = run(
    `INSERT INTO vehicles (vehicle_number, plate_number, type, capacity, status, notes)
     VALUES (?, ?, 'VAN', 14, 'AVAILABLE', ?)`,
    ['Car #02', 'ط ر ق 4421', 'تويوتا هاي إيس VIP - سيارة احتياطية']
  );

  // 5. Routes
  const r1 = run(
    `INSERT INTO routes (name, start_location, end_location, direction, estimated_duration_min)
     VALUES (?, ?, ?, 'GO', 45)`,
    ['شبين الكوم → المجمع النظري / الجامعة', 'شبين الكوم', 'جامعة المنوفية']
  );
  const route1Id = r1.lastInsertRowid;

  const r2 = run(
    `INSERT INTO routes (name, start_location, end_location, direction, estimated_duration_min)
     VALUES (?, ?, ?, 'GO', 60)`,
    ['منوف → شبين الكوم / الجامعة', 'منوف', 'مجمع كليات الجامعة']
  );
  const route2Id = r2.lastInsertRowid;

  // 6. Pickup Points for Route 1
  const pp1 = run(
    `INSERT INTO pickup_points (route_id, name, sequence_order, expected_time_offset_min, landmark)
     VALUES (?, ?, 1, 0, ?)`,
    [route1Id, 'ميدان شرف', 'أمام صيدلية الإسعاف']
  );
  const pp2 = run(
    `INSERT INTO pickup_points (route_id, name, sequence_order, expected_time_offset_min, landmark)
     VALUES (?, ?, 2, 12, ?)`,
    [route1Id, 'شارع الجلاء', 'أمام صيدلية النجار وهايبر زهران']
  );
  const pp3 = run(
    `INSERT INTO pickup_points (route_id, name, sequence_order, expected_time_offset_min, landmark)
     VALUES (?, ?, 3, 25, ?)`,
    [route1Id, 'كوبري القاصد', 'أمام عمر أفندي']
  );
  const pp4 = run(
    `INSERT INTO pickup_points (route_id, name, sequence_order, expected_time_offset_min, landmark)
     VALUES (?, ?, 4, 40, ?)`,
    [route1Id, 'بوابة مجمع الكليات', 'بوابة كلية الهندسة والعلوم']
  );

  // Pickup Points for Route 2
  run(
    `INSERT INTO pickup_points (route_id, name, sequence_order, expected_time_offset_min, landmark)
     VALUES (?, 'محطة قطار منوف', 1, 0, 'أمام المحطة'),
            (?, 'ميدان الحصوة - سرس الليان', 2, 20, 'الميدان الرئيسي'),
            (?, 'مدخل شبين الكوم', 3, 40, 'بجوار مستشفى الجامعة'),
            (?, 'مجمع الكليات', 4, 55, 'البوابة الرئيسية')`,
    [route2Id, route2Id, route2Id, route2Id]
  );

  // 7. Students
  const s1User = run(
    `INSERT INTO users (full_name, phone, email, password_hash, role)
     VALUES (?, ?, ?, ?, 'STUDENT')`,
    ['محمد أحمد حسن', '01012345678', 'mohamed@example.com', hashStudent]
  );
  const s1 = run(
    `INSERT INTO students (user_id, student_code, default_pickup_id, emergency_phone, institution, grade_level)
     VALUES (?, 'STU-2026-00101', ?, '01009998877', 'جامعة المنوفية - كلية الحاسبات', 'الفرقة الثالثة')`,
    [s1User.lastInsertRowid, pp2.lastInsertRowid]
  );

  const s2User = run(
    `INSERT INTO users (full_name, phone, email, password_hash, role)
     VALUES (?, ?, ?, ?, 'STUDENT')`,
    ['سارة خالد إبراهيم', '01087654321', 'sara@example.com', hashStudent]
  );
  const s2 = run(
    `INSERT INTO students (user_id, student_code, default_pickup_id, emergency_phone, institution, grade_level)
     VALUES (?, 'STU-2026-00102', ?, '01011122233', 'جامعة المنوفية - كلية الهندسة', 'الفرقة الثانية')`,
    [s2User.lastInsertRowid, pp1.lastInsertRowid]
  );

  const s3User = run(
    `INSERT INTO users (full_name, phone, email, password_hash, role)
     VALUES (?, ?, ?, ?, 'STUDENT')`,
    ['عمر طارق سالم', '01555555555', 'omar@example.com', hashStudent]
  );
  const s3 = run(
    `INSERT INTO students (user_id, student_code, default_pickup_id, emergency_phone, institution, grade_level)
     VALUES (?, 'STU-2026-00103', ?, '01522233344', 'جامعة المنوفية - كلية التجارة', 'الفرقة الأولى')`,
    [s3User.lastInsertRowid, pp3.lastInsertRowid]
  );

  const s4User = run(
    `INSERT INTO users (full_name, phone, email, password_hash, role)
     VALUES (?, ?, ?, ?, 'STUDENT')`,
    ['ياسمين مصطفى عبد الرحمن', '01099998888', 'yasmin@example.com', hashStudent]
  );
  const s4 = run(
    `INSERT INTO students (user_id, student_code, default_pickup_id, emergency_phone, institution, grade_level)
     VALUES (?, 'STU-2026-00104', ?, '01033344455', 'جامعة المنوفية - كلية الصيدلة', 'الفرقة الرابعة')`,
    [s4User.lastInsertRowid, pp2.lastInsertRowid]
  );

  // 8. Daily Operations Cycles: Yesterday (Closed) & Today (Open)
  const todayStr = getTodayString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  run(
    `INSERT INTO daily_operations (date, status, opened_at, closed_at, closed_by, notes)
     VALUES (?, 'CLOSED', datetime('now', '-1 day', 'localtime'), datetime('now', '-1 day', '+16 hours', 'localtime'), ?, ?)`,
    [yStr, adminId, 'تم إغلاق دورة الأمس بنجاح بنسبة حضور 94%']
  );

  run(
    `INSERT INTO daily_operations (date, status, opened_at, notes)
     VALUES (?, 'OPEN', datetime('now', 'localtime'), ?)`,
    [todayStr, 'دورة اليوم مفتوحة للحجوزات وتسجيل الحضور']
  );

  // 9. Trips for Today
  const trip1 = run(
    `INSERT INTO trips (trip_code, date, departure_time, route_id, vehicle_id, driver_id, capacity, booked_seats, status)
     VALUES (?, ?, '07:30', ?, ?, ?, 40, 3, 'SCHEDULED')`,
    [`TRP-${todayStr.replace(/-/g, '')}-01`, todayStr, route1Id, v1.lastInsertRowid, driver1.lastInsertRowid]
  );
  const trip1Id = trip1.lastInsertRowid;

  const trip2 = run(
    `INSERT INTO trips (trip_code, date, departure_time, route_id, vehicle_id, driver_id, capacity, booked_seats, status)
     VALUES (?, ?, '07:15', ?, ?, ?, 50, 1, 'SCHEDULED')`,
    [`TRP-${todayStr.replace(/-/g, '')}-02`, todayStr, route2Id, v2.lastInsertRowid, driver2.lastInsertRowid]
  );
  const trip2Id = trip2.lastInsertRowid;

  // 10. Bookings for Today
  // Student 1 (Mohamed Ahmed) on Trip 1 -> NOT checked in yet (Ready for student to test button)
  const b1 = run(
    `INSERT INTO bookings (booking_code, student_id, trip_id, date, pickup_point_id, qr_code_token, status)
     VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED')`,
    ['STU-2026-001245', s1.lastInsertRowid, trip1Id, todayStr, pp2.lastInsertRowid, 'QR-WAS-STU1-' + Date.now()]
  );

  // Student 2 (Sara Khaled) on Trip 1 -> Already checked in via QR
  const b2 = run(
    `INSERT INTO bookings (booking_code, student_id, trip_id, date, pickup_point_id, qr_code_token, status)
     VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED')`,
    ['STU-2026-001246', s2.lastInsertRowid, trip1Id, todayStr, pp1.lastInsertRowid, 'QR-WAS-STU2-' + Date.now()]
  );
  run(
    `INSERT INTO attendances (booking_id, student_id, trip_id, date, status, method, checked_in_at, verified_by_user_id)
     VALUES (?, ?, ?, ?, 'PRESENT', 'DRIVER_QR_SCAN', datetime('now', '-30 minutes', 'localtime'), ?)`,
    [b2.lastInsertRowid, s2.lastInsertRowid, trip1Id, todayStr, driver1User.lastInsertRowid]
  );

  // Student 4 (Yasmin) on Trip 1 -> Not checked in yet
  run(
    `INSERT INTO bookings (booking_code, student_id, trip_id, date, pickup_point_id, qr_code_token, status)
     VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED')`,
    ['STU-2026-001248', s4.lastInsertRowid, trip1Id, todayStr, pp3.lastInsertRowid, 'QR-WAS-STU4-' + Date.now()]
  );

  // Student 3 (Omar) on Trip 2
  run(
    `INSERT INTO bookings (booking_code, student_id, trip_id, date, pickup_point_id, qr_code_token, status)
     VALUES (?, ?, ?, ?, 5, ?, 'CONFIRMED')`,
    ['STU-2026-001247', s3.lastInsertRowid, trip2Id, todayStr, 'QR-WAS-STU3-' + Date.now()]
  );

  console.log('--- Demonstration Data Seeded Successfully ---');
  console.log('Admin login:    01000000000 / admin123');
  console.log('Driver login:   01111111111 / driver123');
  console.log('Student login:  01012345678 / student123 (Mohamed - Not checked in yet)');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}

module.exports = { seed };
