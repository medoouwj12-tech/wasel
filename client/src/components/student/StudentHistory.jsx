import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, XCircle, Bus, MapPin, Award } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function StudentHistory() {
  const { showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ history: [], summary: {} });
  const [cancellingBookingId, setCancellingBookingId] = useState(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/student/history');
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل سجل الحضور.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('هل تريد إلغاء هذا الحجز؟ سيصبح المقعد متاحاً لطالب آخر.')) return;
    try {
      setCancellingBookingId(bookingId);
      const res = await api.post('/student/cancel-booking', { booking_id: bookingId });
      if (res.success) {
        showToast(res.message, 'success');
        await fetchHistory();
      }
    } catch (err) {
      showToast(err.message || 'تعذر إلغاء الحجز.', 'error');
    } finally {
      setCancellingBookingId(null);
    }
  };

  const summary = data.summary || {};

  return (
    <div className="space-y-5 pb-8 animate-fade-in max-w-xl mx-auto">
      {/* Summary KPI Cards */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
        <h3 className="font-extrabold text-slate-900 text-sm mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-blue-600" />
          <span>إحصائيات التزامك بالحضور</span>
        </h3>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[11px] text-slate-400 font-bold block mb-1">الرحلات المحجوزة</span>
            <span className="text-xl font-black text-slate-800">{summary.total_bookings || 0}</span>
          </div>

          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
            <span className="text-[11px] text-emerald-600 font-bold block mb-1">مرات الحضور</span>
            <span className="text-xl font-black text-emerald-700">{summary.attended_count || 0}</span>
          </div>

          <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
            <span className="text-[11px] text-blue-600 font-bold block mb-1">نسبة الحضور</span>
            <span className="text-xl font-black text-blue-700">{summary.attendance_percentage || 0}%</span>
          </div>
        </div>
      </div>

      {/* History List */}
      <div>
        <h4 className="text-xs font-bold text-slate-400 mb-2.5 px-1">سجل الرحلات السابقة:</h4>

        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">جاري تحميل السجل...</p>
          </div>
        ) : data.history.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">لا توجد رحلات سابقة مسجلة حتى الآن.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.history.map((item) => {
              const isPresent = item.attendance_label === 'PRESENT';
              return (
                <div
                  key={item.booking_id}
                  className="bg-white rounded-3xl p-4 sm:p-5 shadow-xs border border-slate-200/90 transition hover:border-slate-300"
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div>
                      <span className="text-[11px] text-slate-400 font-semibold block">
                        {item.formatted_date || item.date} • {item.departure_time} صباحاً
                      </span>
                      <h4 className="font-bold text-slate-800 text-sm mt-0.5">
                        {item.route_name}
                      </h4>
                    </div>

                    {isPresent ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>حاضر ✓</span>
                      </span>
                    ) : item.attendance_label === 'CANCELLED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>حجز ملغي</span>
                      </span>
                    ) : item.attendance_label === 'PENDING' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                        <span>لم يسجل بعد</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>لم يحضر</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-600">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                      <span className="truncate">{item.pickup_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Bus className="w-3 h-3 text-blue-600 shrink-0" />
                      <span>{item.vehicle_number}</span>
                    </div>
                  </div>

                  {isPresent && item.checked_in_at && (
                    <div className="text-[10px] text-emerald-700 font-medium mt-2 text-right">
                      وقت تسجيل الحضور: {item.checked_in_at} ({item.attendance_method === 'SELF_APP' ? 'تطبيق الطالب' : 'مسح QR السائق'})
                    </div>
                  )}
                  {item.can_cancel && (
                    <button
                      onClick={() => handleCancelBooking(item.booking_id)}
                      disabled={cancellingBookingId === item.booking_id}
                      className="mt-3 w-full sm:w-auto px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancellingBookingId === item.booking_id ? 'جارٍ الإلغاء...' : 'إلغاء الحجز'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
