import React from 'react';
import { Bus, User, LogOut, Shield, Navigation } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Header() {
  const { user, role, logout } = useAuth();

  const getRoleLabel = () => {
    switch (role) {
      case 'ADMIN':
        return { text: 'مدير النظام', color: 'bg-purple-100 text-purple-700 border-purple-200' };
      case 'DRIVER':
        return { text: 'سائق / كابتن', color: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'STUDENT':
      default:
        return { text: 'طالب', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
  };

  const roleInfo = getRoleLabel();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900">
                واصل
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium -mt-1 hidden sm:block">
              نظام نقل وحضور الطلاب اليومي
            </p>
          </div>
        </div>

        {/* User & Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {user && (
            <div className="flex items-center gap-2 pl-1 border-r border-slate-200 pr-2">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-800 leading-tight">
                  {user.full_name}
                </div>
                <span
                  className={`inline-block text-[10px] font-semibold px-2 py-0.2 rounded-full border ${roleInfo.color}`}
                >
                  {roleInfo.text}
                </span>
              </div>

              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
