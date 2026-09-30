import React, { useState, useEffect } from 'react';
import { Bus, Plus, XCircle, Calendar, Clock, MapPin, Users, X, Check, Edit2 } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminTrips({ defaultDate }) {
  const { showToast } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return defaultDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);

  // Aux resources for creating trip
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    date: selectedDate,
    departure_time: '07:30',
    route_id: '',
    vehicle_id: '',
    driver_id: '',
    capacity: 40,
  });

  const fetchTrips = async (date) => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/trips?date=${date}`);
      if (res.success) {
        setTrips(res.trips);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل الرحلات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async () => {
    try {
      const [rRes, vRes, dRes] = await Promise.all([
        api.get('/admin/routes'),
        api.get('/admin/vehicles'),
        api.get('/admin/drivers'),
      ]);
      if (rRes.success) setRoutes(rRes.routes);
      if (vRes.success) setVehicles(vRes.vehicles);
      if (dRes.success) setDrivers(dRes.drivers);
    } catch (err) {
      console.error('Fetch resources error:', err);
    }
  };

  useEffect(() => {
    fetchTrips(selectedDate);
    fetchResources();
  }, [selectedDate]);

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    if (!formData.route_id || !formData.vehicle_id || !formData.driver_id) {
      showToast('يرجى اختيار خط السير والمركبة والسائق.', 'error');
      return;
    }

    try {
      const res = await api.post('/admin/trips', {
        ...formData,
        date: selectedDate,
      });
      if (res.success) {
        showToast(res.message, 'success');
        setShowAddModal(false);
        fetchTrips(selectedDate);
      }
    } catch (err) {
      showToast(err.message || 'فشل إضافة الرحلة.', 'error');
    }
  };

  const handleUpdateTrip = async (e) => {
    e.preventDefault();
    if (!editingTrip) return;

    try {
      const res = await api.put(`/admin/trips/${editingTrip.id}`, {
        departure_time: editingTrip.departure_time,
        route_id: editingTrip.route_id,
        vehicle_id: editingTrip.vehicle_id,
        driver_id: editingTrip.driver_id,
        capacity: editingTrip.capacity,
      });

      if (res.success) {
        showToast(res.message, 'success');
        setEditingTrip(null);
        fetchTrips(selectedDate);
      }
    } catch (err) {
      showToast(err.message || 'فشل تعديل بيانات الرحلة.', 'error');
    }
  };

  const handleCancelTrip = async (tripId) => {
    if (!window.confirm('هل تريد إلغاء الرحلة؟ ستُلغى الحجوزات المرتبطة ويظل سجلها محفوظاً.')) {
      return;
    }

    try {
      const res = await api.post(`/admin/trips/${tripId}/cancel`, {});
      if (res.success) {
        showToast(res.message, 'success');
        fetchTrips(selectedDate);
      }
    } catch (err) {
      showToast(err.message || 'فشل إلغاء الرحلة.', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Action Bar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold">
            <Calendar className="w-4 h-4 text-blue-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent outline-none text-slate-800"
            />
          </div>
          <span className="text-xs text-slate-400">إجمالي رحلات اليوم: {trips.length}</span>
        </div>

        <button
          onClick={() => {
            if (routes.length === 0 || vehicles.length === 0 || drivers.length === 0) {
              showToast('يرجى أولاً إضافة خط سير ومركبة وسائق لتتمكن من إنشاء الرحلة.', 'warning');
            }
            setFormData({
              ...formData,
              date: selectedDate,
              route_id: routes[0]?.id || '',
              vehicle_id: vehicles[0]?.id || '',
              driver_id: drivers[0]?.id || '',
            });
            setShowAddModal(true);
          }}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>جدولة رحلة جديدة</span>
        </button>
      </div>

      {/* Trips Cards Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">جاري تحميل الرحلات...</p>
        </div>
      ) : trips.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <Bus className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-700 text-sm">لا توجد رحلات مجدولة لهذا التاريخ</h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            قم بإضافة خطوط السير والمركبات والسائقين، ثم اضغط على زر "جدولة رحلة جديدة".
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
          >
            جدولة رحلة الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trips.map((trip) => {
            const occupancyPct = trip.capacity > 0 ? Math.round((trip.booked_seats / trip.capacity) * 100) : 0;
            return (
              <div
                key={trip.id}
                className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/90 relative hover:border-blue-300 transition"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 font-bold block">
                      {trip.trip_code}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base">{trip.route_name}</h3>
                  </div>

                  <div className="flex items-center gap-1">
                    {trip.status === 'SCHEDULED' && (
                      <>
                        <button
                          onClick={() => setEditingTrip(trip)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="تعديل الرحلة"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCancelTrip(trip.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="إلغاء الرحلة"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-3">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>الانطلاق: <strong>{trip.departure_time} صباحاً</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Bus className="w-3.5 h-3.5 text-blue-600" />
                    <span>المركبة: <strong>{trip.vehicle_number}</strong></span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 text-slate-600">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    <span>السائق: <strong>{trip.driver_name}</strong></span>
                  </div>
                </div>

                {/* Capacity Counter */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span>المقاعد المحجوزة:</span>
                    <span className="font-mono">
                      {trip.booked_seats} / {trip.capacity} مقعد (متبقي {trip.available_seats})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        trip.is_full
                          ? 'bg-rose-500'
                          : occupancyPct > 80
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, occupancyPct)}%` }}
                    />
                  </div>
                </div>

                {/* Attendance Summary */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-700">حاضر: {trip.present_count || 0}</span>
                  <span className="text-rose-700">غائب: {trip.absent_count || 0}</span>
                  <span className="text-amber-700">لم يسجلوا بعد: {trip.pending_count || 0}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      trip.is_full ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {trip.status === 'CANCELLED' ? 'ملغاة' : trip.status === 'COMPLETED' ? 'مكتملة' : trip.is_full ? 'مكتملة المقاعد' : 'متاحة للحجز'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 1. Modal: Add Trip */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-lg text-slate-900 mb-1">جدولة رحلة جديدة</h3>
            <p className="text-xs text-slate-500 mb-4">تحديد خط السير، المركبة، والسائق لتاريخ {selectedDate}</p>

            <form onSubmit={handleCreateTrip} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">وقت انطلاق الرحلة:</label>
                <input
                  type="time"
                  required
                  value={formData.departure_time}
                  onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">خط السير والاتجاه:</label>
                <select
                  required
                  value={formData.route_id}
                  onChange={(e) => setFormData({ ...formData, route_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- اختر خط السير --</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.direction === 'GO' ? 'ذهاب' : r.direction === 'RETURN' ? 'عودة' : 'دائري'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المركبة:</label>
                <select
                  required
                  value={formData.vehicle_id}
                  onChange={(e) => {
                    const v = vehicles.find((veh) => String(veh.id) === e.target.value);
                    setFormData({
                      ...formData,
                      vehicle_id: e.target.value,
                      capacity: v ? v.capacity : formData.capacity,
                      driver_id: v?.driver_id || formData.driver_id,
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- اختر المركبة --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} ({v.type}) - سعة {v.capacity} راكب
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">السائق المكلف:</label>
                <select
                  required
                  value={formData.driver_id}
                  onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- اختر السائق --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} ({d.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">سعة المقاعد المتاحة للرحلة:</label>
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
                  إضافة الرحلة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Edit Trip */}
      {editingTrip && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setEditingTrip(null)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-lg text-slate-900 mb-1">تعديل بيانات الرحلة</h3>
            <p className="text-xs text-slate-500 mb-4">{editingTrip.trip_code}</p>

            <form onSubmit={handleUpdateTrip} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">وقت الانطلاق:</label>
                <input
                  type="time"
                  required
                  value={editingTrip.departure_time}
                  onChange={(e) => setEditingTrip({ ...editingTrip, departure_time: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">خط السير:</label>
                <select
                  required
                  value={editingTrip.route_id}
                  onChange={(e) => setEditingTrip({ ...editingTrip, route_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المركبة:</label>
                <select
                  required
                  value={editingTrip.vehicle_id}
                  onChange={(e) => setEditingTrip({ ...editingTrip, vehicle_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} ({v.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">السائق:</label>
                <select
                  required
                  value={editingTrip.driver_id}
                  onChange={(e) => setEditingTrip({ ...editingTrip, driver_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعة المقاعد:</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    required
                    value={editingTrip.capacity}
                    onChange={(e) => setEditingTrip({ ...editingTrip, capacity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="flex flex-col justify-center rounded-xl bg-slate-100 p-3 text-xs">
                  <span className="font-bold text-slate-500">حالة الرحلة</span>
                  <span className="font-bold text-slate-800">مجدولة — يديرها السائق عند بدء الرحلة</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTrip(null)}
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
