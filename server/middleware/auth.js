const jwt = require('jsonwebtoken');
const { queryOne } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'wasel-development-only-secret-do-not-deploy';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Production requires JWT_SECRET with at least 32 characters.');
}

/**
 * Generate JWT token for user
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      role: user.role,
      full_name: user.full_name,
    },
    JWT_SECRET,
    { expiresIn: '30d' } // Long-lived for persistent mobile sessions
  );
}

/**
 * Middleware to authenticate JWT token
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'لم يتم توفير رمز الدخول (Token). يُرجى تسجيل الدخول مجدداً.',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(403).json({
      success: false,
      message: 'جلسة الدخول منتهية أو غير صالحة. يُرجى تسجيل الدخول.',
    });
  }

  const user = await queryOne(
    'SELECT id, full_name, phone, email, role, is_active FROM users WHERE id = ?',
    [decoded.id]
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'المستخدم غير موجود في النظام.',
    });
  }

  if (!user.is_active) {
    return res.status(403).json({
      success: false,
      message: 'تم تعطيل هذا الحساب من قبل الإدارة. يرجى مراجعة المشرف.',
    });
  }

  if (user.role === 'STUDENT') {
    req.student = await queryOne(
      `SELECT s.id as student_id, s.student_code, s.default_pickup_id, s.emergency_phone, s.institution, s.grade_level,
              p.name as default_pickup_name
       FROM students s
       LEFT JOIN pickup_points p ON s.default_pickup_id = p.id
       WHERE s.user_id = ?`,
      [user.id]
    );
  } else if (user.role === 'DRIVER') {
    req.driver = await queryOne(
      'SELECT id as driver_id, license_number, experience_years, status FROM drivers WHERE user_id = ?',
      [user.id]
    );
  }

  req.user = user;
  next();
}

/**
 * Middleware to require specific role(s)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول إلى هذه الصفحة أو الميزة.',
      });
    }
    if (req.user.role === 'DRIVER' && (!req.driver || req.driver.status !== 'ACTIVE')) {
      return res.status(403).json({
        success: false,
        message: 'حساب السائق غير نشط. يرجى التواصل مع إدارة النقل.',
      });
    }
    next();
  };
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authenticateToken,
  requireRole,
};
