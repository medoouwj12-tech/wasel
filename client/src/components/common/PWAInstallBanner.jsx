import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle, Share, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export default function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  // If already running standalone or user dismissed, don't show
  if (isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else {
      const installed = await promptInstall();
      if (!installed) {
        // Fallback for browsers that don't trigger native prompt directly
        setShowIOSModal(true);
      }
    }
  };

  return (
    <>
      {/* Sleek Installation Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 text-white shadow-lg border-b border-blue-500/30 px-4 py-3 relative z-30 transition-all duration-300">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-right">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shadow-inner shrink-0">
              <Smartphone className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h4 className="font-bold text-sm sm:text-base leading-tight">
                ثبّت تطبيق واصل على هاتفك الآن
              </h4>
              <p className="text-xs text-blue-100 opacity-90 mt-0.5">
                تطبيق حقيقي سريع يفتح مباشرة من الشاشة الرئيسية بدون الحاجة لفتح المتصفح يومياً
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleInstallClick}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-white text-blue-700 hover:bg-blue-50 active:scale-95 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تثبيت التطبيق (Install App)</span>
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition"
              title="إخفاء التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS & Manual Installation Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Smartphone className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                طريقة تثبيت التطبيق على الشاشة الرئيسية
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                لتثبيت تطبيق واصل كـ App مستقل على هاتفك، اتبع الخطوات التالية:
              </p>
            </div>

            <div className="space-y-4 text-sm bg-slate-50 p-4 rounded-2xl border border-slate-200/60 mb-5">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <span className="font-bold text-slate-800">اضغط على زر المشاركة</span>
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-0.5">
                    زر ( <Share className="w-3.5 h-3.5 text-blue-600 inline" /> ) في شريط أدوات المتصفح بالأسفل أو الأعلى.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <span className="font-bold text-slate-800">إضافة إلى الشاشة الرئيسية</span>
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-0.5">
                    مرر لأسفل في القائمة واختر ( <PlusSquare className="w-3.5 h-3.5 text-blue-600 inline" /> إضافة إلى الصفحة الرئيسية / Add to Home Screen ).
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <span className="font-bold text-slate-800">تأكيد التثبيت</span>
                  <p className="text-slate-500 text-xs mt-0.5">
                    اضغط "إضافة (Add)" وسيظهر التطبيق فوراً كأيقونة على شاشة هاتفك لاستخدامه يومياً.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition active:scale-98 shadow-md"
            >
              فهمت ذلك، شكراً
            </button>
          </div>
        </div>
      )}
    </>
  );
}
