import React, { useState } from 'react';
import { User, Phone, ShieldCheck, Smartphone, Download, Save, School, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export default function StudentProfile() {
  const { user, showToast } = useAuth();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();

  const [emergencyPhone, setEmergencyPhone] = useState(user?.student?.emergency_phone || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put('/auth/profile', {
        emergency_phone: emergencyPhone,
      });
      if (res.success) {
        showToast('تم تحديث البيانات بنجاح!', 'success');
      }
    } catch (err) {
      showToast(err.message || 'فشل حفظ التعديلات.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-8 animate-fade-in max-w-xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 text-center">
        <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-3xl flex items-center justify-center font-bold text-2xl mx-auto mb-3 shadow-lg shadow-blue-500/20">
          {user?.full_name?.charAt(0) || 'ط'}
        </div>
        <h2 className="text-xl font-black text-slate-800">{user?.full_name}</h2>
        <p className="text-xs text-blue-600 font-bold mt-0.5">كود الطالب: {user?.student?.student_code}</p>
        <span className="inline-block mt-2 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
          {user?.student?.institution || 'طالب مسجل'}
        </span>
      </div>

      {/* PWA App Installation Box */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-3xl p-5 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-blue-200" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm">تثبيت التطبيق على شاشة الهاتف</h3>
            <p className="text-xs text-blue-100 opacity-90 mt-0.5 mb-3 leading-relaxed">
              ثبت تطبيق واصل ليظهر كأي تطبيق هاتف حقيقي وتفتحه بضغطة زر يومياً بدون البحث عن رابط الموقع في المتصفح.
            </p>
            {isInstalled ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-bold bg-white/10 px-3 py-2 rounded-xl">
                <span>✓ التطبيق مثبت بالفعل على هذا الجهاز</span>
              </div>
            ) : (
              <button
                onClick={promptInstall}
                className="w-full sm:w-auto px-4 py-2.5 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-black shadow transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>تثبيت التطبيق على الهاتف (Add to Home)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Account Info Form */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>بيانات الحساب الشخصي</span>
        </h3>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-500 font-semibold mb-1">رقم الهاتف الأساسي (دائم):</label>
            <input
              type="text"
              disabled
              value={user?.phone || ''}
              className="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-slate-500 cursor-not-allowed font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">البريد الإلكتروني:</label>
            <input
              type="text"
              disabled
              value={user?.email || 'غير مسجل'}
              className="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">هاتف الطوارئ / ولي الأمر:</label>
            <input
              type="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="مثال: 01000000000"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Security Guarantee Note */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-start gap-2.5 text-slate-600 text-xs">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>خصوصية وأمان تام:</strong> حسابك محمي بالكامل بتقنيات التشفير، ولا يستطيع أي طالب آخر الاطلاع على اسمك أو رقم هاتفك أو سجل رحلاتك وحضورك بأي شكل من الأشكال.
        </p>
      </div>
    </div>
  );
}
