import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Phone, ShieldCheck, CheckCircle2, XCircle, Eye, Power, X, Edit2, Trash2 } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminStudents() {
  const { showToast } = useAuth();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [viewHistoryStudent, setViewHistoryStudent] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [routes, setRoutes] = useState([]);

  // New Student Form
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: 'student123',
    institution: '',
    emergency_phone: '',
    default_pickup_id: '',
  });

  const fetchStudents = async (query = '') => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/students${query ? `?search=${encodeURIComponent(query)}` : ''}`);
      if (res.success && res.students) {
        setStudents(res.students);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل بيانات الطلاب.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents(search);
    api.get('/admin/routes').then((r) => {
      if (r.success) setRoutes(r.routes);
    });
  }, [search]);

  const handleToggleStatus = async (studentId) => {
    try {
      const res = await api.patch(`/admin/students/${studentId}/status`, {});
      if (res.success) {
        showToast(res.message, 'success');
        fetchStudents(search);
      }
    } catch (err) {
      showToast(err.message || 'فشل تعديل حالة الطالب.', 'error');
    }
  };

  const handleViewHistory = async (student) => {
    setViewHistoryStudent(student);
    try {
      setHistoryLoading(true);
      const res = await api.get(`/admin/students/${student.student_id}/history`);
      if (res.success && res.logs) {
        setHistoryLogs(res.logs);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل سجل الطالب.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/students', formData);
      if (res.success) {
        showToast(res.message, 'success');
        setShowAddModal(false);
        setFormData({
          full_name: '',
          phone: '',
          email: '',
          password: 'student123',
          institution: '',
          emergency_phone: '',
          default_pickup_id: '',
        });
        fetchStudents();
      }
    } catch (err) {
      showToast(err.message || 'فشل إضافة الطالب.', 'error');
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      const res = await api.put(`/admin/students/${editingStudent.student_id}`, {
        full_name: editingStudent.full_name,
        phone: editingStudent.phone,
        email: editingStudent.email,
        emergency_phone: editingStudent.emergency_phone,
        institution: editingStudent.institution,
        default_pickup_id: editingStudent.default_pickup_id ? parseInt(editingStudent.default_pickup_id, 10) : null,
        password: editingStudent.newPassword || undefined,
      });

      if (res.success) {
        showToast(res.message, 'success');
        setEditingStudent(null);
        fetchStudents(search);
      }
    } catch (err) {
      showToast(err.message || 'فشل تعديل بيانات الطالب.', 'error');
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('هل أنت متأكد من حذف حساب هذا الطالب نهائياً من النظام؟')) return;

    try {
      const res = await api.delete(`/admin/students/${studentId}`);
      if (res.success) {
        showToast(res.message, 'success');
        fetchStudents(search);
      }
    } catch (err) {
      showToast(err.message || 'فشل حذف الطالب.', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header & Search */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>شؤون الطلاب (Students Directory)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            إضافة وتعديل وحذف الطلاب، متابعة نسبة التزام الحضور، وتفعيل أو تعطيل الحسابات.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث بالاسم أو الهاتف أو الكود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة طالب</span>
          </button>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">جاري تحميل بيانات الطلاب...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-slate-700 text-sm">لا يوجد طلاب مسجلون حالياً</h3>
            <p className="text-slate-400 mt-1 mb-4">
              تم تنظيف كافة البيانات الوهمية بنجاح. يستطيع الطلاب الآن إنشاء حسابات حقيقية من شاشة تسجيل الحساب الجديد أو يمكنك إضافتهم يدوياً من زر "إضافة طالب".
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
            >
              إضافة أول طالب
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold">
                <tr>
                  <th className="py-3.5 px-4">الطالب والكود</th>
                  <th className="py-3.5 px-3">رقم الهاتف</th>
                  <th className="py-3.5 px-3">المؤسسة / الكلية</th>
                  <th className="py-3.5 px-3">الحجوزات</th>
                  <th className="py-3.5 px-3">الحضور</th>
                  <th className="py-3.5 px-3">نسبة الحضور</th>
                  <th className="py-3.5 px-3">الحالة</th>
                  <th className="py-3.5 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => {
                  const isActive = s.is_active === 1;
                  return (
                    <tr key={s.student_id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{s.full_name}</div>
                        <span className="text-[11px] font-mono text-blue-600 font-bold">{s.student_code}</span>
                      </td>

                      <td className="py-3.5 px-3 font-mono font-semibold text-slate-700">
                        {s.phone}
                      </td>

                      <td className="py-3.5 px-3 text-slate-600">
                        {s.institution || '—'}
                      </td>

                      <td className="py-3.5 px-3 font-bold text-slate-800">
                        {s.total_bookings}
                      </td>

                      <td className="py-3.5 px-3 font-bold text-emerald-700">
                        {s.attended_count}
                      </td>

                      <td className="py-3.5 px-3 font-extrabold text-blue-700">
                        {s.total_bookings > 0 ? `${s.attendance_rate}%` : '—'}
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isActive ? 'نشط' : 'معطل'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingStudent(s)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="تعديل بيانات الطالب"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleViewHistory(s)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="سجل الحضور"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(s.student_id)}
                            className={`p-1.5 rounded-lg transition ${
                              isActive
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(s.student_id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="حذف الطالب"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* 1. Modal: Edit Student */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setEditingStudent(null)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-lg text-slate-900 mb-1">تعديل بيانات الطالب</h3>
            <p className="text-xs text-slate-500 mb-4 font-mono">{editingStudent.student_code}</p>

            <form onSubmit={handleUpdateStudent} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الاسم الكامل:</label>
                <input
                  type="text"
                  required
                  value={editingStudent.full_name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                  <input
                    type="tel"
                    required
                    value={editingStudent.phone}
                    onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">هاتف الطوارئ:</label>
                  <input
                    type="tel"
                    value={editingStudent.emergency_phone || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, emergency_phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الجامعة / الكلية / المدرسة:</label>
                <input
                  type="text"
                  value={editingStudent.institution || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, institution: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نقطة الركوب الافتراضية:</label>
                <select
                  value={editingStudent.default_pickup_id || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, default_pickup_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none"
                >
                  <option value="">بدون نقطة محددة</option>
                  {routes.map((r) => (
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
                <label className="block font-bold text-slate-700 mb-1">تغيير كلمة المرور (اختياري):</label>
                <input
                  type="password"
                  placeholder="اترك فارغاً للاحتفاظ بكلمة المرور الحالية"
                  value={editingStudent.newPassword || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, newPassword: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-md"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: View History */}
      {viewHistoryStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setViewHistoryStudent(null)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-lg text-slate-900 mb-1">
              سجل رحلات وحضور الطالب: {viewHistoryStudent.full_name}
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-mono">
              كود: {viewHistoryStudent.student_code} • هاتف: {viewHistoryStudent.phone}
            </p>

            {historyLoading ? (
              <div className="py-12 text-center text-slate-400">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs">جاري تحميل السجل...</p>
              </div>
            ) : historyLogs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                لا توجد رحلات أو حجوزات مسجلة لهذا الطالب حتى الآن.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">التاريخ</th>
                      <th className="py-2.5 px-3">رقم الحجز</th>
                      <th className="py-2.5 px-3">الخط والمركبة</th>
                      <th className="py-2.5 px-3">نقطة الركوب</th>
                      <th className="py-2.5 px-3">الحالة</th>
                      <th className="py-2.5 px-3">وقت التسجيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyLogs.map((log, idx) => {
                      const isPresent = log.attendance_status === 'PRESENT';
                      return (
                        <tr key={idx}>
                          <td className="py-2.5 px-3 font-mono font-bold">{log.date}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{log.booking_code}</td>
                          <td className="py-2.5 px-3 text-slate-800 font-semibold">{log.route_name} ({log.vehicle_number})</td>
                          <td className="py-2.5 px-3 text-slate-600">{log.pickup_name}</td>
                          <td className="py-2.5 px-3">
                            {isPresent ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">حاضر ✓</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">غائب</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono">{log.checked_in_at || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Modal: Add Student */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-lg text-slate-900 mb-1">تسجيل طالب جديد في النظام</h3>
            <p className="text-xs text-slate-500 mb-4">إنشاء حساب للطالب للتمكن من الدخول وحجز الرحلات</p>

            <form onSubmit={handleCreateStudent} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الاسم الكامل للطالب:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: يوسف إبراهيم السيد"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف (اسم المستخدم):</label>
                <input
                  type="tel"
                  required
                  placeholder="مثال: 01012345678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">البريد الإلكتروني (اختياري):</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">كلمة المرور الابتدائية:</label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المؤسسة التعليمية / الكلية:</label>
                <input
                  type="text"
                  placeholder="مثال: جامعة المنوفية - كلية الهندسة"
                  value={formData.institution}
                  onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نقطة الركوب الافتراضية:</label>
                <select
                  value={formData.default_pickup_id}
                  onChange={(e) => setFormData({ ...formData, default_pickup_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none"
                >
                  <option value="">بدون نقطة محددة</option>
                  {routes.map((r) => (
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

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-md"
                >
                  تسجيل الطالب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
