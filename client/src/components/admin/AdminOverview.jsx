import React, { useState, useEffect } from 'react';
import {
  Users,
  Bus,
  Calendar,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Clock,
  Shield,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminOverview({ onNavigate }) {
  const { showToast } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOverview = async (date) => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/overview?date=${date}`);
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل إحصائيات لوحة الإدارة.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview(selectedDate);
  }, [selectedDate]);

  const handleToggleDay = async () => {
    if (!stats) return;
    const isClosed = stats.day_status === 'CLOSED';
    const action = isClosed ? 'open' : 'close';

    const confirmMsg = isClosed
      ? `هل تريد إعادة فتح دورة يوم ${selectedDate}؟`
      : `هل أنت متأكد من إغلاق دورة يوم ${selectedDate}؟ بعد الإغلاق لن يتمكن الطلاب من تعديل الحجوزات أو تسجيل الحضور!`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoading(true);
      const res = await api.post(`/admin/daily-operations/${action}`, {
        date: selectedDate,
        notes: isClosed ? 'تم إعادة فتح اليوم يدوياً' : 'تم إغلاق اليوم واعتماد السجلات بواسطة الإدارة',
      });
      if (res.success) {
        showToast(res.message, 'success');
        await fetchOverview(selectedDate);
      }
    } catch (err) {
      showToast(err.message || 'فشل تعديل حالة اليوم.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper date shortcuts
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Date Filter & Daily Status Bar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Date Shortcuts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedDate(todayStr)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedDate === todayStr
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            اليوم (Today)
          </button>
          <button
            onClick={() => setSelectedDate(tomorrowStr)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedDate === tomorrowStr
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            غداً (Tomorrow)
          </button>
          <button
            onClick={() => setSelectedDate(yesterdayStr)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedDate === yesterdayStr
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            أمس (Yesterday)
          </button>

          {/* Custom Date Input */}
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-2.5 py-1.5 border border-slate-200 text-xs font-mono">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent outline-none text-slate-800 font-bold"
            />
          </div>
        </div>

        {/* Day Status & Close/Open Action */}
        {stats && (
          <div className="flex items-center gap-3 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">حالة الدورة:</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  stats.day_status === 'OPEN'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    stats.day_status === 'OPEN' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                {stats.day_status === 'OPEN' ? 'مفتوحة للحجوزات والحضور' : 'مغلقة (Closed)'}
              </span>
            </div>

            <button
              onClick={handleToggleDay}
              disabled={actionLoading}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                stats.day_status === 'OPEN'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {actionLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : stats.day_status === 'OPEN' ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>إغلاق اليوم</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>إعادة فتح اليوم</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 2. KPI Analytics Cards Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Students */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/90">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold">الطلاب المسجلون</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {stats.total_students}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">حسابات نشطة في النظام</span>
          </div>

          {/* Today Trips */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/90">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold">رحلات اليوم</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Bus className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {stats.today_trips}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">مجدولة لليوم المحدد</span>
          </div>

          {/* Today Bookings */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/90">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold">إجمالي الحجوزات</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {stats.today_bookings}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">مقعد مؤكد اليوم</span>
          </div>

          {/* Attendance Rate */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/90">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold">نسبة الحضور</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700">
              {stats.attendance_rate}%
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {stats.present_count} حاضر من {stats.today_bookings}
            </span>
          </div>

          {/* Present Count */}
          <div className="bg-emerald-50/60 rounded-3xl p-5 border border-emerald-200">
            <div className="flex items-center justify-between text-emerald-800 mb-1">
              <span className="text-xs font-bold">حاضرون (تم الصعود)</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-900">
              {stats.present_count}
            </div>
            <p className="text-[11px] text-emerald-700 mt-1">سجلوا حضورهم اليوم</p>
          </div>

          {/* Absent Count */}
          <div className="bg-rose-50/60 rounded-3xl p-5 border border-rose-200">
            <div className="flex items-center justify-between text-rose-800 mb-1">
              <span className="text-xs font-bold">غائبون</span>
              <XCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-900">
              {stats.absent_count}
            </div>
            <p className="text-[11px] text-rose-700 mt-1">بعد إنهاء الرحلة أو إغلاق اليوم</p>
          </div>

          <div className="bg-amber-50/60 rounded-3xl p-5 border border-amber-200">
            <div className="flex items-center justify-between text-amber-800 mb-1">
              <span className="text-xs font-bold">لم يسجلوا بعد</span>
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-900">
              {stats.pending_count}
            </div>
            <p className="text-[11px] text-amber-700 mt-1">ما زال وقت تسجيلهم مفتوحاً</p>
          </div>

          {/* Available Vehicles */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold">المركبات الجاهزة</span>
              <Bus className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {stats.available_vehicles}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">أوتوبيسات وسيارات متاحة</p>
          </div>

          {/* Active Drivers */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold">السائقون النشطون</span>
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {stats.active_drivers}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">على رأس العمل</p>
          </div>
        </div>
      )}

      {/* 3. Recent Bookings & Live Attendance Feed */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>آخر حركة للحجوزات وتسجيل الحضور ({selectedDate})</span>
          </h3>
          <button
            onClick={() => onNavigate && onNavigate('reports')}
            className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>استعراض كافة السجلات</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {!stats?.recent_bookings?.length ? (
          <p className="text-xs text-slate-400 text-center py-8">
            لا توجد حجوزات مسجلة في هذا التاريخ حتى الآن.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">رقم الحجز</th>
                  <th className="py-2.5 px-3">اسم الطالب</th>
                  <th className="py-2.5 px-3">خط السير</th>
                  <th className="py-2.5 px-3">المركبة</th>
                  <th className="py-2.5 px-3">حالة الحضور</th>
                  <th className="py-2.5 px-3">وقت التسجيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recent_bookings.map((b, idx) => {
                  const isPresent = b.attendance_status === 'PRESENT';
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">
                        {b.booking_code}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {b.student_name}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{b.route_name}</td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {b.vehicle_number}
                      </td>
                      <td className="py-3 px-3">
                        {isPresent ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            حاضر ✓
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            لم يحضر بعد
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono">
                        {b.checked_in_at || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
