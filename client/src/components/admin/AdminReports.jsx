import React, { useState, useEffect } from 'react';
import { FileText, Download, Printer, Filter, Calendar, CheckCircle2, XCircle, Search } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminReports() {
  const { showToast } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'ABSENT'
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');

  const fetchReports = async () => {
    try {
      setLoading(true);
      let url = `/admin/reports/attendance?date=${selectedDate}`;
      if (selectedRoute) url += `&route_id=${selectedRoute}`;
      if (statusFilter !== 'ALL') url += `&status=${statusFilter}`;

      const res = await api.get(url);
      if (res.success && res.records) {
        setRecords(res.records);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل التقارير.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/admin/routes').then((r) => {
      if (r.success) setRoutes(r.routes);
    });
  }, []);

  useEffect(() => {
    fetchReports();
  }, [selectedDate, statusFilter, selectedRoute]);

  // Export to CSV formatted for Excel with Arabic UTF-8 BOM
  const exportCSV = () => {
    if (!records.length) {
      showToast('لا توجد بيانات متاحة للتصدير.', 'error');
      return;
    }

    const headers = [
      'التاريخ',
      'كود الحجز',
      'اسم الطالب',
      'كود الطالب',
      'رقم الهاتف',
      'خط السير',
      'المركبة',
      'نقطة الركوب',
      'السائق',
      'حالة الحضور',
      'وقت التسجيل',
      'طريقة الحضور',
    ];

    const csvCell = (value) => {
      let text = String(value ?? '');
      if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = records.map((r) => [
      r.date,
      r.booking_code,
      r.student_name,
      r.student_code,
      r.student_phone,
      r.route_name,
      r.vehicle_number,
      r.pickup_name,
      r.driver_name,
      r.attendance_label === 'PRESENT' ? 'حاضر' : r.attendance_label === 'ABSENT' ? 'غائب' : 'لم يسجل بعد',
      r.checked_in_at || '—',
      r.attendance_method || '—',
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `تقرير_حضور_الطلاب_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('تم تصدير ملف Excel / CSV بنجاح!', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const presentCount = records.filter((r) => r.is_present).length;
  const absentCount = records.filter((r) => r.attendance_label === 'ABSENT').length;
  const pendingCount = records.filter((r) => r.attendance_label === 'PENDING').length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Filters & Actions Bar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono font-bold">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent outline-none text-slate-800"
            />
          </div>

          {/* Route Filter */}
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-bold"
          >
            <option value="">جميع خطوط السير</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-bold"
          >
            <option value="ALL">جميع الحالات (الكل)</option>
            <option value="PRESENT">الحاضرون فقط (Present)</option>
            <option value="ABSENT">الغياب فقط (Absent)</option>
          </select>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={exportCSV}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Excel / CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* Summary Mini Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center">
          <span className="text-[11px] text-slate-400 font-bold block mb-1">إجمالي الطلاب في التقرير</span>
          <span className="text-xl font-black text-slate-900">{records.length}</span>
        </div>
        <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200 text-center">
          <span className="text-[11px] text-emerald-700 font-bold block mb-1">حاضرون</span>
          <span className="text-xl font-black text-emerald-800">{presentCount}</span>
        </div>
        <div className="bg-rose-50/60 rounded-2xl p-4 border border-rose-200 text-center">
          <span className="text-[11px] text-rose-700 font-bold block mb-1">غائبون</span>
          <span className="text-xl font-black text-rose-800">{absentCount}</span>
        </div>
        <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200 text-center">
          <span className="text-[11px] text-amber-700 font-bold block mb-1">لم يسجلوا بعد</span>
          <span className="text-xl font-black text-amber-800">{pendingCount}</span>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">جاري تجهيز بيانات التقرير...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            لا توجد سجلات تطابق الفلتر المختار في هذا التاريخ.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-3">كود الحجز</th>
                  <th className="py-3 px-3">اسم الطالب</th>
                  <th className="py-3 px-3">رقم الهاتف</th>
                  <th className="py-3 px-3">خط السير</th>
                  <th className="py-3 px-3">نقطة الركوب</th>
                  <th className="py-3 px-3">المركبة والسائق</th>
                  <th className="py-3 px-3">حالة الحضور</th>
                  <th className="py-3 px-3">وقت التسجيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">
                      {r.booking_code}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {r.student_name}
                      <span className="text-[10px] text-slate-400 block font-mono font-normal">{r.student_code}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">{r.student_phone}</td>
                    <td className="py-3 px-3 text-slate-700 font-semibold">{r.route_name}</td>
                    <td className="py-3 px-3 text-slate-600">{r.pickup_name}</td>
                    <td className="py-3 px-3 text-slate-600">
                      {r.vehicle_number} ({r.driver_name})
                    </td>
                    <td className="py-3 px-3">
                      {r.attendance_label === 'PRESENT' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          حاضر ✓
                        </span>
                      ) : r.attendance_label === 'ABSENT' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          غائب
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          لم يسجل بعد
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono">
                      {r.checked_in_at || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
