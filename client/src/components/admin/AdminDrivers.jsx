import React, { useState, useEffect } from 'react';
import { Shield, Plus, Phone, Edit2, Trash2, X, Check, Bus } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminDrivers() {
  const { showToast } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: 'driver123',
    license_number: '',
    experience_years: 5,
  });

  // Edit modal
  const [editingDriver, setEditingDriver] = useState(null);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/drivers');
      if (res.success && res.drivers) {
        setDrivers(res.drivers);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل بيانات السائقين.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.full_name || !formData.phone || !formData.password) {
      showToast('الاسم ورقم الهاتف وكلمة المرور مطلوبة.', 'error');
      return;
    }

    try {
      const res = await api.post('/admin/drivers', formData);
      if (res.success) {
        showToast(res.message, 'success');
        setShowAddModal(false);
        setFormData({
          full_name: '',
          phone: '',
          email: '',
          password: 'driver123',
          license_number: '',
          experience_years: 5,
        });
        fetchDrivers();
      }
    } catch (err) {
      showToast(err.message || 'فشل إضافة السائق.', 'error');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingDriver) return;

    try {
      const res = await api.put(`/admin/drivers/${editingDriver.id}`, {
        full_name: editingDriver.full_name,
        phone: editingDriver.phone,
        email: editingDriver.email,
        license_number: editingDriver.license_number,
        experience_years: editingDriver.experience_years,
        status: editingDriver.status,
        password: editingDriver.newPassword || undefined,
      });

      if (res.success) {
        showToast(res.message, 'success');
        setEditingDriver(null);
        fetchDrivers();
      }
    } catch (err) {
      showToast(err.message || 'فشل تعديل السائق.', 'error');
    }
  };

  const handleDelete = async (driverId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السائق؟')) return;

    try {
      const res = await api.delete(`/admin/drivers/${driverId}`);
      if (res.success) {
        showToast(res.message, 'success');
        fetchDrivers();
      }
    } catch (err) {
      showToast(err.message || 'فشل حذف السائق.', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" />
            <span>إدارة السائقين والمشرفين (Drivers Management)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            إضافة وتعديل وحذف حسابات السائقين، تعيين رخص القيادة، وتحديد المركبات المكلفين بها.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة كابتن / سائق</span>
        </button>
      </div>

      {/* Drivers List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">جاري تحميل بيانات السائقين...</p>
        </div>
      ) : drivers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-700 text-sm">لا يوجد سائقون مسجلون بعد</h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            النظام جاهز ونظيف. يمكنك إضافة أول سائق الآن لتعيينه على المركبات والرحلات.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
          >
            إضافة أول سائق
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {drivers.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/90 relative hover:border-slate-300 transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">{d.full_name}</h3>
                    <span className="text-[11px] font-mono text-slate-500 font-bold block">{d.phone}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingDriver(d)}
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                    title="تعديل بيانات السائق"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="حذف السائق"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-xs space-y-1.5 mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">رقم الرخصة:</span>
                  <strong className="text-slate-800 font-mono">{d.license_number || 'غير مسجلة'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">سنوات الخبرة:</span>
                  <strong className="text-slate-800">{d.experience_years} سنوات</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">المركبة الحالية:</span>
                  <span className="text-slate-800 font-semibold">{d.vehicle_number || 'لا توجد مركبة معينة'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span
                  className={`px-2 py-0.5 rounded-full font-bold ${
                    d.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {d.status === 'ACTIVE' ? 'نشط على العمل' : 'إجازة / غير متاح'}
                </span>

                <a
                  href={`tel:${d.phone}`}
                  className="flex items-center gap-1 text-blue-600 font-bold hover:underline"
                >
                  <Phone className="w-3 h-3" />
                  <span>اتصال</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 1. Modal: Add Driver */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-lg text-slate-900 mb-1">تسجيل كابتن / سائق جديد</h3>
            <p className="text-xs text-slate-500 mb-4">إنشاء حساب للدخول واستخدام ماسح الـ QR للرحلات</p>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الاسم الكامل للسائق:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: كابتن أحمد محمود السيد"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الهاتف (لتسجيل الدخول):</label>
                  <input
                    type="tel"
                    required
                    placeholder="010XXXXXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold font-mono outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">كلمة المرور:</label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم رخصة القيادة:</label>
                  <input
                    type="text"
                    placeholder="DL-XXXXX"
                    value={formData.license_number}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">سنوات الخبرة:</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={formData.experience_years}
                    onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono outline-none"
                  />
                </div>
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
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition shadow-md"
                >
                  تسجيل السائق
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Edit Driver */}
      {editingDriver && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setEditingDriver(null)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-lg text-slate-900 mb-1">تعديل بيانات السائق</h3>
            <p className="text-xs text-slate-500 mb-4">{editingDriver.full_name}</p>

            <form onSubmit={handleUpdate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الاسم الكامل:</label>
                <input
                  type="text"
                  required
                  value={editingDriver.full_name}
                  onChange={(e) => setEditingDriver({ ...editingDriver, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                <input
                  type="tel"
                  required
                  value={editingDriver.phone}
                  onChange={(e) => setEditingDriver({ ...editingDriver, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold font-mono outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الرخصة:</label>
                  <input
                    type="text"
                    value={editingDriver.license_number || ''}
                    onChange={(e) => setEditingDriver({ ...editingDriver, license_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الحالة:</label>
                  <select
                    value={editingDriver.status || 'ACTIVE'}
                    onChange={(e) => setEditingDriver({ ...editingDriver, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none font-bold"
                  >
                    <option value="ACTIVE">نشط على العمل (Active)</option>
                    <option value="OFF_DUTY">إجازة (Off Duty)</option>
                    <option value="SUSPENDED">موقوف (Suspended)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تغيير كلمة المرور (اختياري):</label>
                <input
                  type="password"
                  placeholder="اترك فارغاً للاحتفاظ بكلمة المرور الحالية"
                  value={editingDriver.newPassword || ''}
                  onChange={(e) => setEditingDriver({ ...editingDriver, newPassword: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDriver(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition shadow-md"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
