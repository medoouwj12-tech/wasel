import React, { useState, useEffect } from 'react';
import { Bus, Smartphone, ShieldCheck, UserPlus, LogIn, MapPin, School, Phone, Lock, User, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';

export default function AuthPage() {
  const { login, register, showToast } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [submitting, setSubmitting] = useState(false);
  const [publicInfo, setPublicInfo] = useState({ routes: [], settings: {} });

  // Login form
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPickupId, setRegPickupId] = useState('');
  const [regInstitution, setRegInstitution] = useState('جامعة المنوفية - مجمع الكليات');
  const [regEmergencyPhone, setRegEmergencyPhone] = useState('');

  // Fetch public routes and pickups for registration dropdown
  useEffect(() => {
    api.get('/public/info')
      .then((d) => {
        if (d.success) {
          setPublicInfo(d);
          // Set first pickup as default if available
          const firstPickup = d.routes[0]?.pickup_points[0]?.id;
          if (firstPickup) setRegPickupId(String(firstPickup));
        }
      })
      .catch(() => setPublicInfo({ routes: [], settings: {} }));
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginPhone || !loginPassword) {
      showToast('يرجى إدخال رقم الهاتف وكلمة المرور.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await login(loginPhone, loginPassword);
    } catch (err) {
      // Handled by context toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regFullName || !regPhone || !regPassword) {
      showToast('يرجى إكمال الحقول الأساسية: الاسم، الهاتف، وكلمة المرور.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await register({
        full_name: regFullName,
        phone: regPhone,
        email: regEmail || null,
        password: regPassword,
        default_pickup_id: regPickupId || null,
        institution: regInstitution,
        emergency_phone: regEmergencyPhone || null,
      });
    } catch (err) {
      // Handled by context toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-blue-50/40 to-slate-100 flex flex-col justify-center items-center p-4 py-8">
      {/* Brand Hero */}
      <div className="text-center max-w-md w-full mb-6">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-700 flex items-center justify-center text-white mx-auto mb-3 shadow-xl shadow-blue-500/25">
          <Bus className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          واصل | نقل وحضور الطلاب
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          تطبيق ويب تقدمي (PWA) ذكي لتنظيم رحلات الطلاب وحضورهم اليومي
        </p>
      </div>

      {/* Main Form Box */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 border border-slate-200/90 max-w-md w-full">
        {/* Toggle Mode: Login vs Register */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>تسجيل الدخول (Login)</span>
          </button>

          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>حساب جديد (Create Account)</span>
          </button>
        </div>

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs animate-fade-in">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                رقم الهاتف المسجل أو البريد:
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="01012345678"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-9 pl-3 py-3 font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">كلمة المرور:</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-9 pl-3 py-3 font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/25 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>دخول إلى التطبيق</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs animate-fade-in">
            <div>
              <label className="block font-bold text-slate-700 mb-1">الاسم الكامل للطالب:</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="مثال: يوسف إبراهيم أحمد"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-9 pl-3 py-2.5 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                <input
                  type="tel"
                  required
                  placeholder="010XXXXXXXX"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">كلمة المرور:</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  placeholder="8 أحرف أو أكثر"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">نقطة الركوب الأساسية المفضلة:</label>
              <select
                value={regPickupId}
                onChange={(e) => setRegPickupId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              >
                {publicInfo.routes?.map((r) => (
                  <optgroup key={r.id} label={r.name}>
                    {r.pickup_points?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">الجامعة / الكلية / المدرسة:</label>
              <input
                type="text"
                placeholder="جامعة المنوفية - كلية الحاسبات"
                value={regInstitution}
                onChange={(e) => setRegInstitution(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/25 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>إنشاء الحساب وتثبيت التطبيق</span>
                </>
              )}
            </button>
          </form>
        )}

      </div>

      {/* PWA Promotion Footer Note */}
      <div className="mt-6 text-center text-xs text-slate-500 max-w-sm flex items-center justify-center gap-2">
        <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
        <span>تطبيق ويب تقدمي (PWA) قابل للتثبيت كـ App حقيقي على الهواتف</span>
      </div>
    </div>
  );
}
