import React, { useState, useEffect } from 'react';
import { Settings, Save, Shield, Clock, Building, Bell } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminSettings() {
  const { showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    company_name: 'شركة واصل لنقل الطلاب والجامعات',
    company_phone: '01001234567',
    company_email: 'info@wasel-transport.com',
    auto_close_time: '23:59',
    booking_cutoff_min: '30',
    allow_advance_booking_days: '3',
    allow_cancellation: 'true',
    cancellation_cutoff_min: '60',
    allow_student_self_check_in: 'false',
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/settings');
      if (res.success && res.settings) {
        setSettings((prev) => ({ ...prev, ...res.settings }));
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل إعدادات النظام.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put('/admin/settings', settings);
      if (res.success) {
        showToast(res.message, 'success');
      }
    } catch (err) {
      showToast(err.message || 'فشل حفظ الإعدادات.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-400">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs">جاري تحميل إعدادات النظام...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200">
        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5 text-blue-600" />
          <span>إعدادات النظام والعمليات التشغيلية (System Settings)</span>
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          ضبط معايير مواعيد الحجز وإغلاق الأيام التلقائي وسياسات النقل
        </p>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Company Info */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Building className="w-4 h-4 text-blue-600" />
              <span>بيانات جهة النقل والشركة</span>
            </h3>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">اسم المؤسسة / الشركة:</label>
              <input
                type="text"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">هاتف التواصل / خدمة العملاء:</label>
                <input
                  type="text"
                  value={settings.company_phone}
                  onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">البريد الإلكتروني الرسمي:</label>
                <input
                  type="email"
                  value={settings.company_email}
                  onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Daily Cycle & Booking Rules */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>قواعد دورة اليوم ومواعيد الحجز</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  وقت إغلاق دورة اليوم التلقائي:
                </label>
                <input
                  type="time"
                  value={settings.auto_close_time}
                  onChange={(e) => setSettings({ ...settings, auto_close_time: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  يتم إغلاق دورة اليوم في هذا الوقت تلقائياً واعتماد السجلات
                </span>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  إغلاق الحجز قبل انطلاق الرحلة بـ:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={settings.booking_cutoff_min}
                    onChange={(e) => setSettings({ ...settings, booking_cutoff_min: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-slate-500 shrink-0 font-bold">دقيقة</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  أيام الحجز المسبق المتاحة:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={settings.allow_advance_booking_days}
                    onChange={(e) => setSettings({ ...settings, allow_advance_booking_days: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-slate-500 shrink-0 font-bold">أيام</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  السماح بإلغاء الحجز قبل الرحلة بـ:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="10"
                    max="300"
                    value={settings.cancellation_cutoff_min}
                    onChange={(e) => setSettings({ ...settings, cancellation_cutoff_min: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-slate-500 shrink-0 font-bold">دقيقة</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Shield className="w-4 h-4 text-amber-600" />
              <span>سياسة إثبات الحضور</span>
            </h3>
            <label className="flex items-start gap-2.5 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allow_student_self_check_in === 'true'}
                onChange={(e) => setSettings({ ...settings, allow_student_self_check_in: e.target.checked ? 'true' : 'false' })}
                className="mt-0.5 accent-blue-600"
              />
              <span>
                السماح للطالب بتأكيد حضوره بنفسه
                <span className="block text-[11px] text-slate-500 mt-0.5">عند إيقافه، لا يُحتسب الحضور إلا بعد مسح السائق لرمز QR أو تسجيله يدوياً.</span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-slate-700 cursor-pointer border-t border-amber-200 pt-3">
              <input
                type="checkbox"
                checked={settings.allow_cancellation === 'true'}
                onChange={(e) => setSettings({ ...settings, allow_cancellation: e.target.checked ? 'true' : 'false' })}
                className="mt-0.5 accent-blue-600"
              />
              <span>السماح للطلاب بإلغاء حجوزاتهم ضمن المهلة المحددة</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ كافة الإعدادات</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
