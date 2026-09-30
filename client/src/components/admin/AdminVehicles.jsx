import React, { useState, useEffect } from 'react';
import { Bus, Car, Plus, Shield, CheckCircle, Wrench, XCircle, X, Edit2, Trash2 } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminVehicles() {
  const { showToast } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_number: '',
    plate_number: '',
    type: 'BUS',
    capacity: 40,
    driver_id: '',
    status: 'AVAILABLE',
    notes: '',
  });

  // Edit modal
  const [editingVehicle, setEditingVehicle] = useState(null);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const [vRes, dRes] = await Promise.all([
        api.get('/admin/vehicles'),
        api.get('/admin/drivers'),
      ]);
      if (vRes.success) setVehicles(vRes.vehicles);
      if (dRes.success) setDrivers(dRes.drivers);
    } catch (err) {
      showToast(err.message || 'فشل تحميل المركبات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/vehicles', formData);
      if (res.success) {
        showToast(res.message, 'success');
        setShowAddModal(false);
        setFormData({
          vehicle_number: '',
          plate_number: '',
          type: 'BUS',
          capacity: 40,
          driver_id: '',
          status: 'AVAILABLE',
          notes: '',
        });
        fetchVehicles();
      }
    } catch (err) {
      showToast(err.message || 'فشل إضافة المركبة.', 'error');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingVehicle) return;

    try {
      const res = await api.put(`/admin/vehicles/${editingVehicle.id}`, {
        vehicle_number: editingVehicle.vehicle_number,
        plate_number: editingVehicle.plate_number,
        type: editingVehicle.type,
        capacity: editingVehicle.capacity,
        driver_id: editingVehicle.driver_id || null,
        status: editingVehicle.status,
        notes: editingVehicle.notes,
      });

      if (res.success) {
        showToast(res.message, 'success');
        setEditingVehicle(null);
        fetchVehicles();
      }
    } catch (err) {
      showToast(err.message || 'فشل تعديل المركبة.', 'error');
    }
  };

  const handleDelete = async (vehicleId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المركبة؟')) return;

    try {
      const res = await api.delete(`/admin/vehicles/${vehicleId}`);
      if (res.success) {
        showToast(res.message, 'success');
        fetchVehicles();
      }
    } catch (err) {
      showToast(err.message || 'فشل حذف المركبة.', 'error');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">متاحة (Available)</span>;
      case 'ASSIGNED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">مخصصة لرحلة</span>;
      case 'MAINTENANCE':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">صيانة دورية</span>;
      case 'INACTIVE':
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">غير نشطة</span>;
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Bus className="w-5 h-5 text-blue-600" />
            <span>إدارة أسطول المركبات (Cars & Buses)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            إضافة وتعديل وحذف الأوتوبيسات والميكروباصات والسيارات، وتحديد السعة القصوى وتعيين السائقين وتغيير الحالات.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مركبة جديدة</span>
        </button>
      </div>

      {/* Vehicles Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">جاري تحميل أسطول المركبات...</p>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <Bus className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-700 text-sm">لا توجد مركبات مسجلة حتى الآن</h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            النظام جاهز ونظيف. يمكنك إضافة أوتوبيسات وسيارات النقل التابعة لك الآن.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
          >
            إضافة أول مركبة
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/90 relative hover:border-slate-300 transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    {v.type === 'BUS' ? <Bus className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">{v.vehicle_number}</h3>
                    <span className="text-[11px] font-mono text-slate-400 font-bold block">{v.plate_number}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingVehicle(v)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="تعديل بيانات المركبة"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="حذف المركبة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mb-2">
                {getStatusBadge(v.status)}
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-xs space-y-1.5 mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">نوع المركبة:</span>
                  <strong className="text-slate-800">
                    {v.type === 'BUS' ? 'أوتوبيس كبير' : v.type === 'VAN' ? 'ميكروباص / فان' : 'سيارة خاصة'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">سعة الركاب:</span>
                  <strong className="text-slate-800 font-mono">{v.capacity} مقعد</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">السائق المعين:</span>
                  <span className="text-slate-800 font-semibold">{v.driver_name || 'بدون سائق حالياً'}</span>
                </div>
              </div>

              {v.notes && (
                <p className="text-[11px] text-slate-500 bg-slate-50/60 p-2 rounded-xl border border-slate-100">
                  {v.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 1. Modal: Add Vehicle */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-lg text-slate-900 mb-1">إضافة مركبة جديدة للأسطول</h3>
            <p className="text-xs text-slate-500 mb-4">أدخل بيانات السيارة أو الأوتوبيس</p>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">كود / اسم المركبة:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أوتوبيس 01 أو Bus #01"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم اللوحة المعدنية:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أ ب ج 1234"
                    value={formData.plate_number}
                    onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع المركبة:</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="BUS">أوتوبيس (Bus)</option>
                    <option value="VAN">ميكروباص / فان (Van)</option>
                    <option value="CAR">سيارة (Car)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعة المقاعد القصوى:</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    required
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">السائق المعين:</label>
                  <select
                    value={formData.driver_id}
                    onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">بدون سائق حالياً</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الحالة التشغيلية:</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="AVAILABLE">متاحة وجاهزة للرحلات (Available)</option>
                  <option value="ASSIGNED">مخصصة لرحلة حالياً (Assigned)</option>
                  <option value="MAINTENANCE">في الصيانة الدورية (Maintenance)</option>
                  <option value="INACTIVE">غير نشطة (Inactive)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات ومواصفات:</label>
                <input
                  type="text"
                  placeholder="مثال: مكيف، مقاعد مريحة..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                  حفظ المركبة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Edit Vehicle */}
      {editingVehicle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setEditingVehicle(null)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-lg text-slate-900 mb-1">تعديل بيانات المركبة</h3>
            <p className="text-xs text-slate-500 mb-4">{editingVehicle.vehicle_number} ({editingVehicle.plate_number})</p>

            <form onSubmit={handleUpdate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">كود / اسم المركبة:</label>
                <input
                  type="text"
                  required
                  value={editingVehicle.vehicle_number}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, vehicle_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم اللوحة:</label>
                  <input
                    type="text"
                    required
                    value={editingVehicle.plate_number}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, plate_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع المركبة:</label>
                  <select
                    value={editingVehicle.type}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="BUS">أوتوبيس (Bus)</option>
                    <option value="VAN">ميكروباص / فان (Van)</option>
                    <option value="CAR">سيارة (Car)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعة المقاعد:</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    required
                    value={editingVehicle.capacity}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, capacity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">السائق المعين:</label>
                  <select
                    value={editingVehicle.driver_id || ''}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, driver_id: e.target.value ? parseInt(e.target.value, 10) : null })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">بدون سائق</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الحالة:</label>
                <select
                  value={editingVehicle.status}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="AVAILABLE">متاحة (Available)</option>
                  <option value="ASSIGNED">مخصصة لرحلة (Assigned)</option>
                  <option value="MAINTENANCE">صيانة (Maintenance)</option>
                  <option value="INACTIVE">غير نشطة (Inactive)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات إضافية:</label>
                <input
                  type="text"
                  value={editingVehicle.notes || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
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
    </div>
  );
}
