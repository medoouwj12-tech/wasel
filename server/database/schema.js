const { db } = require('./db');

function initSchema() {
  db.exec(`
    -- 1. Users Table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('STUDENT', 'DRIVER', 'ADMIN')),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 2. Students Profile Table
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      student_code TEXT UNIQUE NOT NULL,
      default_pickup_id INTEGER,
      emergency_phone TEXT,
      institution TEXT,
      grade_level TEXT,
      notes TEXT
    );

    -- 3. Drivers Profile Table
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      license_number TEXT,
      license_expiry TEXT,
      experience_years INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'OFF_DUTY', 'SUSPENDED'))
    );

    -- 4. Vehicles Table
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_number TEXT UNIQUE NOT NULL,
      plate_number TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('BUS', 'VAN', 'CAR')),
      capacity INTEGER NOT NULL CHECK(capacity > 0),
      driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'INACTIVE')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 5. Routes Table
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_location TEXT NOT NULL,
      end_location TEXT NOT NULL,
      direction TEXT DEFAULT 'GO' CHECK(direction IN ('GO', 'RETURN', 'ROUND')),
      estimated_duration_min INTEGER DEFAULT 45,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 6. Pickup Points Table
    CREATE TABLE IF NOT EXISTS pickup_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sequence_order INTEGER NOT NULL,
      expected_time_offset_min INTEGER DEFAULT 0,
      landmark TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 7. Daily Operations (Controls the daily cycle)
    CREATE TABLE IF NOT EXISTS daily_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED')),
      opened_at TEXT DEFAULT (datetime('now', 'localtime')),
      closed_at TEXT,
      closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT
    );

    -- 8. Trips Table (Independent per Date & Daily Cycle)
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_code TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      departure_time TEXT NOT NULL,
      route_id INTEGER NOT NULL REFERENCES routes(id),
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
      driver_id INTEGER NOT NULL REFERENCES drivers(id),
      capacity INTEGER NOT NULL,
      booked_seats INTEGER DEFAULT 0,
      status TEXT DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED')),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 9. Bookings Table (Independent per Student + Trip/Date)
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_code TEXT UNIQUE NOT NULL,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      pickup_point_id INTEGER NOT NULL REFERENCES pickup_points(id),
      qr_code_token TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'CONFIRMED' CHECK(status IN ('CONFIRMED', 'CANCELLED', 'NO_SHOW')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      CONSTRAINT uq_student_trip UNIQUE (student_id, trip_id)
    );

    -- 10. Attendances Table (Records actual student check-in)
    CREATE TABLE IF NOT EXISTS attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'PRESENT' CHECK(status IN ('PRESENT', 'ABSENT', 'EXCUSED')),
      method TEXT NOT NULL CHECK(method IN ('SELF_APP', 'DRIVER_QR_SCAN', 'DRIVER_MANUAL', 'ADMIN')),
      checked_in_at TEXT DEFAULT (datetime('now', 'localtime')),
      verified_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      CONSTRAINT uq_attendance_booking UNIQUE (booking_id)
    );

    -- 11. System Settings Table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- 12. In-App Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'INFO' CHECK(type IN ('INFO', 'SUCCESS', 'WARNING', 'ALERT')),
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 13. Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Performance and Integrity Indexes
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date);
    CREATE INDEX IF NOT EXISTS idx_trips_driver_date ON trips(driver_id, date);
    CREATE INDEX IF NOT EXISTS idx_bookings_student_date ON bookings(student_id, date);
    CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id);
    CREATE INDEX IF NOT EXISTS idx_attendances_student_date ON attendances(student_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendances_trip ON attendances(trip_id);
    CREATE INDEX IF NOT EXISTS idx_daily_ops_date ON daily_operations(date);
  `);
}

module.exports = { initSchema };
