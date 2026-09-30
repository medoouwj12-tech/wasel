import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function NotificationToast() {
  const { toast } = useAuth();

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] sm:w-auto animate-bounce-in">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md text-sm font-semibold transition-all ${
          isSuccess
            ? 'bg-emerald-600/95 text-white border-emerald-500 shadow-emerald-900/20'
            : isError
            ? 'bg-rose-600/95 text-white border-rose-500 shadow-rose-900/20'
            : 'bg-slate-900/95 text-white border-slate-700 shadow-slate-900/30'
        }`}
      >
        <div className="shrink-0">
          {isSuccess && <CheckCircle2 className="w-5 h-5 text-white" />}
          {isError && <AlertCircle className="w-5 h-5 text-white" />}
          {!isSuccess && !isError && <Info className="w-5 h-5 text-blue-300" />}
        </div>
        <p className="flex-1 text-right leading-snug">{toast.message}</p>
      </div>
    </div>
  );
}
