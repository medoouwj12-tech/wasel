import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Bus,
  CheckCircle,
  AlertCircle,
  QrCode,
  Phone,
  ShieldCheck,
  ChevronLeft,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function StudentHome({ onNavigateToBookings }) {
  const { user, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/student/dashboard');
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل بيانات اليوم.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      const res = await api.post('/student/attendance/check-in', {});
      if (res.success) {
        // Trigger celebratory confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#3b82f6', '#f59e0b'],
        });

        showToast(res.message || 'تم تسجيل حضورك بنجاح!', 'success');
        // Refresh state
        await fetchDashboard();
      }
    } catch (err) {
      showToast(err.message || 'فشل تسجيل الحضور.', 'error');
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">جاري تحميل بيانات رحلتك اليومية...</p>
      </div>
    );
  }

  const today = data?.today;
  const booking = today?.booking;
  const tomorrow = data?.tomorrow;
  const student = data?.student;

  const isPresent = booking?.is_present;
  const isDayOpen = today?.is_open;

  return (
    <div className="space-y-5 pb-8 animate-fade-in max-w-xl mx-auto">
      {/* 1. Warm Greeting & Date Card */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-800 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/15 relative overflow-hidden">
        {/* Background decorative circles */}
        <div className="absolute -top-12 -left-12 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-400/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-md text-blue-100">
              <Calendar className="w-3.5 h-3.5" />
              <span>{today?.formatted_date || 'اليوم'}</span>
            </span>

            {/* Daily Cycle Status Badge */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isDayOpen
                  ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                  : 'bg-rose-400/20 text-rose-200 border border-rose-400/30'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isDayOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              {isDayOpen ? 'دورة اليوم مفتوحة' : 'اليوم مغلق'}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            مرحبًا {user?.full_name?.split(' ')[0] || 'بك'} 👋
          </h2>
          <p className="text-blue-100 text-xs sm:text-sm mt-1 opacity-90">
            {student?.institution ? `${student.institution} • ` : ''}كود الطالب: {student?.code || 'STU-2026'}
          </p>
        </div>
      </div>

      {/* 2. Today's Trip & Primary Attendance Card */}
      {booking ? (
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/80 transition-all hover:shadow-md">
          {/* Header of Trip Card */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-xs">
                <Bus className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-semibold block">رحلة اليوم</span>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                  {booking.route_name}
                </h3>
              </div>
            </div>

            <button
              onClick={() => setShowQRModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold border border-slate-200 transition cursor-pointer"
              title="عرض رمز QR للصعود"
            >
              <QrCode className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">رمز الصعود</span>
            </button>
          </div>

          {/* Trip Details Grid */}
          <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>وقت انطلاق الرحلة</span>
              </div>
              <div className="font-extrabold text-slate-800 text-base">
                {booking.departure_time} صباحاً
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Bus className="w-3.5 h-3.5 text-blue-600" />
                <span>المركبة المعينة</span>
              </div>
              <div className="font-extrabold text-slate-800 text-base">
                {booking.vehicle_number}
              </div>
              <span className="text-[11px] text-slate-400 block">{booking.vehicle_plate}</span>
            </div>

            <div className="col-span-2 bg-slate-50 rounded-2xl p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>نقطة ركوبك المحددة</span>
              </div>
              <div className="font-bold text-slate-800 text-sm">
                {booking.pickup_name}
              </div>
              {booking.pickup_landmark && (
                <div className="text-xs text-slate-500 mt-0.5">
                  العلامة المميزة: {booking.pickup_landmark}
                </div>
              )}
            </div>

            {booking.driver_name && (
              <div className="col-span-2 flex items-center justify-between bg-blue-50/60 rounded-2xl p-3 border border-blue-100/60 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-slate-600">السائق: </span>
                  <strong className="text-slate-900 font-bold">{booking.driver_name}</strong>
                </div>
                {booking.driver_phone && (
                  <a
                    href={`tel:${booking.driver_phone}`}
                    className="flex items-center gap-1 text-blue-600 font-bold hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>اتصال</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Attendance Status Badge Display */}
          <div className="mb-4">
            <div className="text-xs text-slate-400 font-semibold mb-1.5">حالة الحضور لليوم:</div>
            {isPresent ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-emerald-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">تم تسجيل الحضور بنجاح</h4>
                    <p className="text-xs text-emerald-600">
                      وقت التسجيل: {booking.checked_in_at || 'مؤكد'} • طريقة: {booking.attendance_method === 'SELF_APP' ? 'تأكيد الطالب من التطبيق' : booking.attendance_method === 'DRIVER_MANUAL' ? 'تسجيل السائق يدوياً' : 'فحص السائق QR'}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-200/60 text-emerald-900 text-xs font-bold rounded-lg">
                  حاضر ✓
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-amber-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
                    !
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">لم يتم تسجيل الحضور بعد</h4>
                    <p className="text-xs text-amber-700">
                      {today?.allow_self_check_in ? 'سجّل حضورك من التطبيق أو اعرض رمز الصعود للسائق.' : 'اعرض رمز الصعود للسائق ليمسحه ويسجل حضورك عند الركوب.'}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-amber-200/60 text-amber-900 text-xs font-bold rounded-lg">
                  لم يحضر بعد
                </span>
              </div>
            )}
          </div>

          {/* PRIMARY ATTENDANCE ACTION BUTTON */}
          <div>
            {isPresent ? (
              <button
                disabled
                className="w-full py-4 px-6 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 bg-emerald-600 text-white opacity-95 cursor-default shadow-md shadow-emerald-500/20"
              >
                <CheckCircle className="w-5 h-5 text-white" />
                <span>تم تسجيل الحضور ✓ ({booking.checked_in_at || 'اليوم'})</span>
              </button>
            ) : isDayOpen && today?.allow_self_check_in ? (
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="w-full py-4 px-6 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 active:scale-98 transition cursor-pointer"
              >
                {checkingIn ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جاري تسجيل الحضور والتحقق...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>تسجيل الحضور الآن</span>
                  </>
                )}
              </button>
            ) : !isDayOpen ? (
              <div className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs bg-slate-100 text-slate-500 text-center border border-slate-200">
                دورة اليوم مغلقة حالياً. لا يمكن تسجيل حضور جديد.
              </div>
            ) : (
              <button
                onClick={() => setShowQRModal(true)}
                className="w-full py-4 px-6 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition cursor-pointer"
              >
                <QrCode className="w-5 h-5" />
                <span>اعرض رمز الصعود للسائق</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Empty State: No booking for Today */
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-3">
            <Bus className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            ليس لديك حجز في رحلة اليوم
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            {isDayOpen
              ? 'يمكنك حجز مقعدك في الرحلات المتاحة لليوم، أو الحجز المسبق لرحلة الغد.'
              : 'دورة اليوم مغلقة حالياً. يمكنك الحجز المسبق لرحلة الغد.'}
          </p>

          <button
            onClick={onNavigateToBookings}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-md transition cursor-pointer"
          >
            <span>استعراض الرحلات المتاحة والحجز</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Tomorrow's Trip Advance Card */}
      <div className="bg-slate-900 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span>رحلة الغد ({tomorrow?.formatted_date || 'اليوم التالي'})</span>
          </div>
          {tomorrow?.has_booking && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              حجزك مؤكد ✓
            </span>
          )}
        </div>

        {tomorrow?.has_booking ? (
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm sm:text-base text-white">
                {tomorrow.booking.route_name}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                الانطلاق: {tomorrow.booking.departure_time} صباحاً • مركبة: {tomorrow.booking.vehicle_number}
              </p>
            </div>
            <button
              onClick={onNavigateToBookings}
              className="text-xs text-blue-400 font-bold hover:underline"
            >
              تفاصيل الحجز
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-sm text-slate-200">
                هل ستسافر غداً إلى الجامعة / المدرسة؟
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                متاح {tomorrow?.trips_available || 2} رحلات جاهزة للحجز المسبق لضمان مقعدك.
              </p>
            </div>
            <button
              onClick={onNavigateToBookings}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
            >
              <span>حجز رحلة الغد الآن</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 4. Boarding QR Modal */}
      {showQRModal && booking && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100 text-center">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="font-black text-lg text-slate-900">رمز الصعود الرقمي (QR)</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              يمكن للسائق مسح هذا الرمز لتسجيل حضورك عند الصعود
            </p>

            {/* QR Code Container */}
            <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-blue-200 inline-block shadow-inner mb-3">
              <QRCodeSVG
                value={booking.qr_code_token || booking.booking_code}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1 mb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">رقم الحجز:</span>
                <strong className="text-slate-800 font-mono">{booking.booking_code}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">نقطة الركوب:</span>
                <span className="text-slate-800 font-semibold">{booking.pickup_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المركبة:</span>
                <span className="text-slate-800 font-semibold">{booking.vehicle_number}</span>
              </div>
            </div>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
