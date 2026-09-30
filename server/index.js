require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initSchema } = require('./database/schema');
const { getTodayString, getOrCreateCycle, closeExpiredCycles } = require('./services/dailyOperationsService');
const { queryAll, queryOne } = require('./database/db');

// Route modules
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const driverRoutes = require('./routes/driver');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Production requires JWT_SECRET with at least 32 characters.');
  }
  if (!process.env.DATABASE_PATH) {
    throw new Error('Production requires DATABASE_PATH pointing to a persistent database volume.');
  }
  if (!process.env.TZ) {
    console.warn('TZ is not set. Configure the server timezone (for example Africa/Cairo) to keep trip times consistent.');
  }
}
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

// Initialize database schema
initSchema();

// Ensure today's cycle exists on server boot
getOrCreateCycle(getTodayString());

// Middlewares
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  next();
});

// Cross-origin access is opt-in. Same-origin app usage does not need CORS.
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
}));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString('ar-EG')}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/admin', adminRoutes);

// Public Information endpoint (for login / register pickup selection & branding)
app.get('/api/public/info', (req, res) => {
  try {
    const settingsRows = queryAll('SELECT key, value FROM settings');
    const settings = {};
    settingsRows.forEach((r) => {
      settings[r.key] = r.value;
    });

    const routes = queryAll('SELECT id, name, start_location, end_location FROM routes WHERE is_active = 1');
    const fullRoutes = routes.map((r) => ({
      ...r,
      pickup_points: queryAll(
        'SELECT id, name, sequence_order, expected_time_offset_min FROM pickup_points WHERE route_id = ? ORDER BY sequence_order ASC',
        [r.id]
      ),
    }));

    return res.json({
      success: true,
      settings: {
        company_name: settings.company_name || 'واصل لنقل الطلاب',
        company_phone: settings.company_phone || '01001234567',
        company_email: settings.company_email || 'info@wasel.com',
      },
      routes: fullRoutes,
    });
  } catch (error) {
    console.error('Public info error:', error);
    return res.status(500).json({ success: false, message: 'فشل تحميل بيانات النظام.' });
  }
});

// 404 for unhandled API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'المسار المطلوب غير موجود في واجهة برمجة التطبيقات (API).' });
});

// Serve frontend build if exists
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: 'حدث خطأ غير متوقع في الخادم.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  closeExpiredCycles();
  const cycleCloser = setInterval(closeExpiredCycles, 60_000);
  cycleCloser.unref();
  console.log(`====================================================`);
  console.log(`🚀 Wasel Transport Server is running on port ${PORT}`);
  console.log(`🌐 Local API URL: http://localhost:${PORT}/api`);
  console.log(`📅 Today's Date Cycle: ${getTodayString()}`);
  console.log(`====================================================`);
});
