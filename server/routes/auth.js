const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { queryOne, run, transaction } = require('../database/db');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'محاولات تسجيل الدخول كثيرة. حاول مرة أخرى بعد قليل.',
});
const registrationRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'تم تجاوز عدد محاولات التسجيل المسموح بها. حاول لاحقاً.',
});

/**
 * POST /api/auth/register
 * Student self-registration
 */
router.post('/register', registrationRateLimit, async (req, res) => {
  try {
    const {
      full_name,
      phone,
      email,
      password,
      default_pickup_id,
      emergency_phone,
      institution,
      grade_level,
      notes,
    } = req.body;

    // Validations
    if (typeof full_name !== 'string' || typeof phone !== 'string' || typeof password !== 'string' || !full_name.trim() || !phone.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال جميع الحقول الأساسية: الاسم الكامل، رقم الهاتف، وكلمة المرور.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب ألا تقل عن 8 أحرف أو أرقام.',
      });
    }

    if (full_name.trim().length > 120 || password.length > 128) {
      return res.status(400).json({ success: false, message: 'الاسم أو كلمة المرور أطول من الحد المسموح.' });
    }

    // Clean phone number
    const cleanPhone = phone.trim();
    if (!/^[0-9+()\-\s]{7,20}$/.test(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'صيغة رقم الهاتف غير صحيحة.' });
    }

    // Check if phone already registered
    const existing = await queryOne('SELECT id FROM users WHERE phone = ?', [cleanPhone]);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'رقم الهاتف هذا مسجل بالفعل. يرجى تسجيل الدخول أو استخدام رقم آخر.',
      });
    }

    const normalizedEmail = typeof email === 'string' && email.trim() ? email.trim() : null;
    const optionalText = (value, maxLength) => typeof value === 'string' ? value.trim().slice(0, maxLength) || null : null;
    const emergencyPhone = optionalText(emergency_phone, 20);
    const normalizedInstitution = optionalText(institution, 160);
    const normalizedGrade = optionalText(grade_level, 80);
    const normalizedNotes = optionalText(notes, 500);
    if (normalizedEmail) {
      if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: 'صيغة البريد الإلكتروني غير صحيحة.' });
      }
      const existingEmail = await queryOne('SELECT id FROM users WHERE lower(email) = lower(?)', [normalizedEmail]);
      if (existingEmail) {
        return res.status(409).json({ success: false, message: 'البريد الإلكتروني مسجل بالفعل.' });
      }
    }

    if (default_pickup_id) {
      const pickupId = Number.parseInt(default_pickup_id, 10);
      const pickup = Number.isInteger(pickupId)
        ? await queryOne('SELECT p.id FROM pickup_points p JOIN routes r ON r.id = p.route_id WHERE p.id = ? AND r.is_active = 1', [pickupId])
        : null;
      if (!pickup) {
        return res.status(400).json({ success: false, message: 'نقطة الركوب المختارة غير متاحة.' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Generate unique student code (e.g. STU-2026-XXXX)
    const currentYear = new Date().getFullYear();
    const randomSuffix = crypto.randomInt(10_000_000, 100_000_000);
    const student_code = `STU-${currentYear}-${randomSuffix}`;
    const requiresApproval = process.env.NODE_ENV === 'production' && process.env.REQUIRE_STUDENT_APPROVAL !== 'false';

    // Insert user and student inside a transaction
    const newUser = await transaction(async ({ run }) => {
      const userRes = await run(
        `INSERT INTO users (full_name, phone, email, password_hash, role, is_active)
         VALUES (?, ?, ?, ?, 'STUDENT', ?)`,
        [full_name.trim(), cleanPhone, normalizedEmail, password_hash, requiresApproval ? 0 : 1]
      );
      const userId = userRes.lastInsertRowid;

      await run(
        `INSERT INTO students (user_id, student_code, default_pickup_id, emergency_phone, institution, grade_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          student_code,
          default_pickup_id ? parseInt(default_pickup_id, 10) : null,
          emergencyPhone,
          normalizedInstitution,
          normalizedGrade,
          normalizedNotes,
        ]
      );

      return {
        id: userId,
        full_name: full_name.trim(),
        phone: cleanPhone,
        email: normalizedEmail,
        role: 'STUDENT',
        student_code,
      };
    });

    if (requiresApproval) {
      return res.status(201).json({
        success: true,
        pending_approval: true,
        message: 'تم استلام طلب إنشاء الحساب. يمكنك تسجيل الدخول بعد مراجعة إدارة النقل وتفعيل الحساب.',
      });
    }

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'تم إنشاء حسابك بنجاح! مرحباً بك في واصل.',
      token,
      user: newUser,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء الحساب. يُرجى المحاولة مرة أخرى.',
    });
  }
});

/**
 * POST /api/auth/login
 * User login for all roles (STUDENT, DRIVER, ADMIN)
 */
router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { login, password } = req.body; // login can be phone or email

    if (typeof login !== 'string' || typeof password !== 'string' || !login.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال رقم الهاتف أو البريد الإلكتروني وكلمة المرور.',
      });
    }

    const cleanLogin = login.trim();

    // Query user by phone or email
    const user = await queryOne(
      `SELECT id, full_name, phone, email, password_hash, role, is_active 
       FROM users 
       WHERE phone = ? OR email = ?`,
      [cleanLogin, cleanLogin]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة. يرجى التأكد من رقم الهاتف أو كلمة المرور.',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'الحساب غير مفعّل حالياً. يرجى مراجعة إدارة النقل أو انتظار اعتماد التسجيل.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة. يرجى التأكد من رقم الهاتف أو كلمة المرور.',
      });
    }

    // Role-specific payload
    let studentInfo = null;
    let driverInfo = null;

    if (user.role === 'STUDENT') {
      studentInfo = await queryOne(
        `SELECT s.id as student_id, s.student_code, s.default_pickup_id, s.emergency_phone, s.institution, s.grade_level,
                p.name as default_pickup_name
         FROM students s
         LEFT JOIN pickup_points p ON s.default_pickup_id = p.id
         WHERE s.user_id = ?`,
        [user.id]
      );
      if (!studentInfo) {
        return res.status(403).json({ success: false, message: 'ملف الطالب غير مكتمل. تواصل مع إدارة النقل.' });
      }
    } else if (user.role === 'DRIVER') {
      driverInfo = await queryOne(
        'SELECT id as driver_id, license_number, status FROM drivers WHERE user_id = ?',
        [user.id]
      );
      if (!driverInfo || driverInfo.status !== 'ACTIVE') {
        return res.status(403).json({ success: false, message: 'حساب السائق غير نشط. يرجى التواصل مع إدارة النقل.' });
      }
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      message: `مرحباً بعودتك، ${user.full_name}!`,
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        student: studentInfo,
        driver: driverInfo,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ غير متوقع أثناء تسجيل الدخول.',
    });
  }
});

/**
 * GET /api/auth/me
 * Get currently authenticated user
 */
router.get('/me', authenticateToken, async (req, res) => {
  return res.json({
    success: true,
    user: {
      ...req.user,
      student: req.student || null,
      driver: req.driver || null,
    },
  });
});

/**
 * PUT /api/auth/profile
 * Update personal profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, email, emergency_phone, default_pickup_id, password } = req.body;

    if (full_name) {
      await run('UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        full_name.trim(),
        req.user.id,
      ]);
    }

    if (email !== undefined) {
      await run('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        email ? email.trim() : null,
        req.user.id,
      ]);
    }

    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      await run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        hash,
        req.user.id,
      ]);
    }

    if (req.user.role === 'STUDENT') {
      await run(
        `UPDATE students 
         SET emergency_phone = COALESCE(?, emergency_phone),
             default_pickup_id = COALESCE(?, default_pickup_id)
         WHERE user_id = ?`,
        [emergency_phone || null, default_pickup_id || null, req.user.id]
      );
    }

    return res.json({
      success: true,
      message: 'تم تحديث الملف الشخصي بنجاح.',
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل تحديث البيانات.',
    });
  }
});

module.exports = router;
