import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Navigation,
  Clock,
  Trash2,
  Edit2,
  X,
  Check,
  ArrowRight,
  ArrowLeft,
  RotateCw,
} from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminRoutes() {
  const { showToast } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Route Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [startLoc, setStartLoc] = useState('');
  const [endLoc, setEndLoc] = useState('');
  const [direction, setDirection] = useState('GO');
  const [durationMin, setDurationMin] = useState(45);
  const [pickups, setPickups] = useState([
    { name: '', expected_time_offset_min: 0, landmark: '' },
  ]);

  // Edit Route Modal
  const [editingRoute, setEditingRoute] = useState(null);

  // Add / Edit Pickup Modal
  const [pickupModalRoute, setPickupModalRoute] = useState(null);
  const [newPickupName, setNewPickupName] = useState('');
  const [newPickupOffset, setNewPickupOffset] = useState(15);
  const [newPickupLandmark, setNewPickupLandmark] = useState('');

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/routes');
      if (res.success && res.routes) {
        setRoutes(res.routes);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل خطوط السير.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const handleAddPickupField = () => {
    setPickups([
      ...pickups,
      { name: '', expected_time_offset_min: (pickups.length * 15), landmark: '' },
    ]);
  };

  const handlePickupChange = (index, field, value) => {
    const updated = [...pickups];
    updated[index][field] = value;
    setPickups(updated);
  };

  const handleRemovePickupField = (index) => {
    if (pickups.length <= 1) return;
    setPickups(pickups.filter((_, i) => i !== index));
  };

  const handleCreateRoute = async (e) => {
    e.preventDefault();
    if (!routeName.trim() || !startLoc.trim() || !endLoc.trim()) {
      showToast('يرجى كتابة اسم الخط ومحطة البداية والنهاية.', 'error');
      return;
    }

    try {
      const validPickups = pickups.filter((p) => p.name.trim());
      const res = await api.post('/admin/routes', {
        name: routeName,
        start_location: startLoc,
        end_location: endLoc,
        direction,
        estimated_duration_min: durationMin,
        pickup_points: validPickups,
      });

      if (res.success) {
        showToast(res.message, 'success');
        setShowAddModal(false);
        setRouteName('');
        setStartLoc('');
        setEndLoc('');
        setDirection('GO');
        setPickups([{ name: '', expected_time_offset_min: 0, landmark: '' }]);
        fetchRoutes();
      }
    } catch (err) {
      showToast(err.message || 'فشل إنشاء الخط.', 'error');
    }
  };

  const handleUpdateRoute = async (e) => {
    e.preventDefault();
    if (!editingRoute) return;

    try {
      const res = await api.put(`/admin/routes/${editingRoute.id}`, {
        name: editingRoute.name,
        start_location: editingRoute.start_location,
        end_location: editingRoute.end_location,
        direction: editingRoute.direction,
        estimated_duration_min: editingRoute.estimated_duration_min,
      });

      if (res.success) {
        showToast(res.message, 'success');
        setEditingRoute(null);
        fetchRoutes();
      }
    } catch (err) {
      showToast(err.message || 'فشل تعديل الخط.', 'error');
    }
  };

  const handleDeleteRoute = async (routeId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الخط بالكامل ومحطاته؟')) {
      return;
    }

    try {
      const res = await api.delete(`/admin/routes/${routeId}`);
      if (res.success) {
        showToast(res.message, 'success');
        fetchRoutes();
      }
    } catch (err) {
      showToast(err.message || 'فشل حذف الخط.', 'error');
    }
  };

  const handleAddPickupToRoute = async (e) => {
    e.preventDefault();
    if (!pickupModalRoute || !newPickupName.trim()) return;

    try {
      const res = await api.post(`/admin/routes/${pickupModalRoute.id}/pickup-points`, {
        name: newPickupName,
        expected_time_offset_min: parseInt(newPickupOffset, 10) || 0,
        landmark: newPickupLandmark,
      });

      if (res.success) {
        showToast(res.message, 'success');
        setPickupModalRoute(null);
        setNewPickupName('');
        setNewPickupOffset(15);
        setNewPickupLandmark('');
        fetchRoutes();
      }
    } catch (err) {
      showToast(err.message || 'فشل إضافة محطة الركوب.', 'error');
    }
  };

  const handleDeletePickup = async (pointId) => {
    if (!window.confirm('هل تريد حذف محطة الركوب هذه؟')) return;

    try {
      const res = await api.delete(`/admin/pickup-points/${pointId}`);
      if (res.success) {
        showToast(res.message, 'success');
        fetchRoutes();
      }
    } catch (err) {
      showToast(err.message || 'فشل حذف محطة الركوب.', 'error');
    }
  };

  const getDirectionBadge = (dir) => {
    switch (dir) {
      case 'GO':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
            <span>ذهاب (GO)</span>
          </span>
        );
      case 'RETURN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" />
            <span>عودة (RETURN)</span>
          </span>
        );
      case 'ROUND':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 flex items-center gap-1">
            <RotateCw className="w-3 h-3" />
            <span>دائري / ذهاب وعودة (ROUND)</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-600" />
            <span>إدارة خطوط السير والاتجاهات ونقاط الركوب</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تحكم كامل في مسارات النقل: تحديد الاتجاه (ذهاب / عودة / دائري)، محطات البداية والنهاية، وإضافة وتعديل نقاط صعود الطلاب.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة خط سير جديد</span>
        </button>
      </div>

      {/* Routes List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">جاري تحميل خطوط السير...</p>
        </div>
      ) : routes.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <Navigation className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-700 text-sm">لا توجد خطوط سير مضافة حتى الآن</h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            النظام جاهز تماماً ونظيف، اضغط على زر "إضافة خط سير جديد" لبدء تحديد اتجاهات ومسارات رحلاتك الحقيقية.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
          >
            إضافة أول خط سير
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {routes.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/90 transition hover:border-slate-300"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 text-base">{r.name}</h3>
                    {getDirectionBadge(r.direction)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span>من: <strong>{r.start_location}</strong></span>
                    <span>•</span>
                    <span>إلى: <strong>{r.end_location}</strong></span>
                    <span>•</span>
                    <span>المدة: {r.estimated_duration_min} دقيقة</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => {
                      setPickupModalRoute(r);
                      setNewPickupName('');
                      setNewPickupOffset(15);
                      setNewPickupLandmark('');
                    }}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="إضافة محطة ركوب جديدة على هذا الخط"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة محطة</span>
                  </button>

                  <button
                    onClick={() => setEditingRoute(r)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    title="تعديل بيانات الخط والاتجاه"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteRoute(r.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                    title="حذف هذا الخط"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Pickup Points Sequence Display */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-2">
                  محطات الركوب والتجمع على الخط ({r.pickup_points?.length || 0} محطات):
                </span>

                {!r.pickup_points?.length ? (
                  <p className="text-xs text-slate-400 italic">
                    لم تتم إضافة محطات ركوب بعد. اضغط "إضافة محطة" بالأعلى لإضافة نقاط التجمع.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {r.pickup_points.map((p, idx) => (
                      <div
                        key={p.id}
                        className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70 text-xs relative group"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0">
                              {p.sequence_order || idx + 1}
                            </span>
                            <span className="truncate">{p.name}</span>
                          </div>

                          <button
                            onClick={() => handleDeletePickup(p.id)}
                            className="text-slate-300 hover:text-rose-600 transition p-1"
                            title="حذف هذه المحطة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {p.expected_time_offset_min > 0
                              ? `+${p.expected_time_offset_min} دقيقة من الانطلاق`
                              : 'محطة الانطلاق الأولى'}
                          </span>
                        </div>

                        {p.landmark && (
                          <div className="text-[10px] text-slate-500 mt-1 bg-white p-1 rounded-lg border border-slate-100 truncate">
                            علامة: {p.landmark}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 1. Modal: Create Route */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-lg text-slate-900 mb-1">إنشاء خط سير واتجاه جديد</h3>
            <p className="text-xs text-slate-500 mb-4">حدد اسم الخط، نوع الاتجاه، ومحطات التجمع</p>

            <form onSubmit={handleCreateRoute} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الخط بالكامل:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: من شبين الكوم إلى جامعة المنوفية"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع الاتجاه (Direction):</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GO">ذهاب (GO - إلى الجامعة / المدرسة)</option>
                  <option value="RETURN">عودة (RETURN - إلى منازل الطلاب)</option>
                  <option value="ROUND">دائري / ذهاب وعودة (ROUND TRIP)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">محطة الانطلاق الأولى:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: شبين الكوم"
                    value={startLoc}
                    onChange={(e) => setStartLoc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">محطة الوصول النهائية:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: مجمع كليات الجامعة"
                    value={endLoc}
                    onChange={(e) => setEndLoc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المدة التقديرية (دقيقة):</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={durationMin}
                  onChange={(e) => setDurationMin(parseInt(e.target.value, 10) || 45)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono outline-none"
                />
              </div>

              {/* Pickup Points Dynamic Form */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-800 text-xs">نقاط الركوب والتجمع (اختياري للبدء):</label>
                  <button
                    type="button"
                    onClick={handleAddPickupField}
                    className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة محطة</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {pickups.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        placeholder="اسم المحطة (مثال: ميدان شرف)"
                        value={p.name}
                        onChange={(e) => handlePickupChange(idx, 'name', e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="فارق الدقائق"
                        value={p.expected_time_offset_min}
                        onChange={(e) => handlePickupChange(idx, 'expected_time_offset_min', parseInt(e.target.value, 10) || 0)}
                        className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-center font-mono outline-none"
                      />
                      {pickups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePickupField(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-3">
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
                  حفظ وإنشاء الخط
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Edit Route & Direction */}
      {editingRoute && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setEditingRoute(null)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-lg text-slate-900 mb-1">تعديل بيانات الخط والاتجاه</h3>
            <p className="text-xs text-slate-500 mb-4">تحديث المسار والاتجاه والمدة التقديرية</p>

            <form onSubmit={handleUpdateRoute} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الخط:</label>
                <input
                  type="text"
                  required
                  value={editingRoute.name}
                  onChange={(e) => setEditingRoute({ ...editingRoute, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع الاتجاه (Direction):</label>
                <select
                  value={editingRoute.direction || 'GO'}
                  onChange={(e) => setEditingRoute({ ...editingRoute, direction: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GO">ذهاب (GO - إلى الجامعة)</option>
                  <option value="RETURN">عودة (RETURN - إلى المنازل)</option>
                  <option value="ROUND">دائري / ذهاب وعودة (ROUND)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">محطة البداية:</label>
                  <input
                    type="text"
                    required
                    value={editingRoute.start_location}
                    onChange={(e) => setEditingRoute({ ...editingRoute, start_location: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">محطة النهاية:</label>
                  <input
                    type="text"
                    required
                    value={editingRoute.end_location}
                    onChange={(e) => setEditingRoute({ ...editingRoute, end_location: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المدة التقديرية (دقيقة):</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={editingRoute.estimated_duration_min}
                  onChange={(e) => setEditingRoute({ ...editingRoute, estimated_duration_min: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRoute(null)}
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

      {/* 3. Modal: Add Pickup Point to specific route */}
      {pickupModalRoute && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setPickupModalRoute(null)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-lg text-slate-900 mb-1">
              إضافة محطة ركوب على خط: {pickupModalRoute.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">أدخل اسم النقطة وفارق وقت الوصول التقديري</p>

            <form onSubmit={handleAddPickupToRoute} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم محطة الركوب:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: ميدان شرف أو كوبري القاصد"
                  value={newPickupName}
                  onChange={(e) => setNewPickupName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">فارق وقت الوصول (بالدقائق من بداية الانطلاق):</label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={newPickupOffset}
                  onChange={(e) => setNewPickupOffset(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">علامة مميزة (اختياري):</label>
                <input
                  type="text"
                  placeholder="مثال: أمام صيدلية الإسعاف"
                  value={newPickupLandmark}
                  onChange={(e) => setNewPickupLandmark(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPickupModalRoute(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-md"
                >
                  إضافة المحطة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
