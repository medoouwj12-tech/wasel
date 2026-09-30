import React, { useState, useEffect } from 'react';
import { Calendar, Lock, Unlock, CheckCircle, Clock, FileText, ChevronLeft, AlertCircle } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminDailyOperations({ onSelectDate }) {
  const { showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchCycles = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/daily-operations');
      if (res.success && res.cycles) {
        setCycles(res.cycles);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل سجل دورات الأيام.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, []);

  const handleCloseDay = async (date) => {
    if (!window.confirm(`هل أنت متأكد من إغلاق دورة يوم ${date}؟ بعد الإغلاق لن يتمكن أي طالب من تعديل الحجز أو تسجيل الحضور.`)) {
      return;
    }

    try {
      setActionLoading(date);
      const res = await api.post('/admin/daily-operations/close', {
        date,
        notes: 'تم إغلاق اليوم واعتماد السجلات النهائية من لوحة العمليات اليومية',
      });
      if (res.success) {
        showToast(res.message, 'success');
        await fetchCycles();
      }
    } catch (err) {
      showToast(err.message || 'فشل إغلاق اليوم.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenDay = async (date) => {
    try {
      setActionLoading(date);
      const res = await api.post('/admin/daily-operations/open', { date });
      if (res.success) {
        showToast(res.message, 'success');
        await fetchCycles();
      }
    } catch (err) {
      showToast(err.message || 'فشل فتح اليوم.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header Info */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span>إدارة دورات الأيام اليومية (Daily Operations)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              مراقبة دورة كل يوم على حدة، إغلاق الأيام المنتهية لحفظ السجلات ومنع التعديلات المتأخرة، وإدارة فتح الأيام الجديدة.
            </p>
          </div>

          <button
            onClick={fetchCycles}
            className="self-start sm:self-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            تحديث السجلات
          </button>
        </div>
      </div>

      {/* Daily Operations Table */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">جاري تحميل دورات الأيام...</p>
          </div>
        ) : cycles.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            لا توجد سجلات دورات أيام مسجلة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold">
                <tr>
                  <th className="py-3.5 px-4">التاريخ (Date)</th>
                  <th className="py-3.5 px-3">الرحلات</th>
                  <th className="py-3.5 px-3">الحجوزات</th>
                  <th className="py-3.5 px-3">الحضور</th>
                  <th className="py-3.5 px-3">الغياب</th>
                  <th className="py-3.5 px-3">نسبة الحضور</th>
                  <th className="py-3.5 px-3">الحالة (Status)</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cycles.map((cycle) => {
                  const isOpen = cycle.status === 'OPEN';
                  const isProcessing = actionLoading === cycle.date;

                  return (
                    <tr key={cycle.id || cycle.date} className="hover:bg-slate-50/70 transition">
                      {/* Date */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        {cycle.date}
                        {cycle.notes && (
                          <span className="block text-[10px] text-slate-400 font-sans font-normal truncate max-w-xs">
                            {cycle.notes}
                          </span>
                        )}
                      </td>

                      {/* Trips Count */}
                      <td className="py-3.5 px-3 font-semibold text-slate-700">
                        {cycle.total_trips || 0}
                      </td>

                      {/* Bookings Count */}
                      <td className="py-3.5 px-3 font-bold text-slate-800">
                        {cycle.total_booked || 0}
                      </td>

                      {/* Present Count */}
                      <td className="py-3.5 px-3 font-bold text-emerald-700">
                        {cycle.present_count || (isOpen ? '—' : 0)}
                      </td>

                      {/* Absent Count */}
                      <td className="py-3.5 px-3 font-bold text-rose-700">
                        {cycle.absent_count || (isOpen ? '—' : 0)}
                      </td>

                      {/* Rate */}
                      <td className="py-3.5 px-3 font-extrabold text-blue-700">
                        {cycle.total_booked > 0 ? `${cycle.attendance_rate}%` : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isOpen
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                            }`}
                          />
                          {isOpen ? 'Open (مفتوح)' : 'Closed (مغلق)'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isOpen ? (
                            <button
                              onClick={() => handleCloseDay(cycle.date)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="إغلاق هذا اليوم"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>إغلاق اليوم</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenDay(cycle.date)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="إعادة فتح هذا اليوم"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>فتح اليوم</span>
                            </button>
                          )}

                          <button
                            onClick={() => onSelectDate && onSelectDate(cycle.date)}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="عرض تفاصيل ورحلات هذا اليوم"
                          >
                            <span>التفاصيل</span>
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
