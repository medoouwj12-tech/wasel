import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Bus,
  Car,
  Navigation,
  Users,
  FileSpreadsheet,
  Settings,
  Shield,
  ChevronLeft,
  UserCheck,
} from 'lucide-react';
import AdminOverview from './AdminOverview';
import AdminDailyOperations from './AdminDailyOperations';
import AdminTrips from './AdminTrips';
import AdminVehicles from './AdminVehicles';
import AdminDrivers from './AdminDrivers';
import AdminRoutes from './AdminRoutes';
import AdminStudents from './AdminStudents';
import AdminReports from './AdminReports';
import AdminSettings from './AdminSettings';

export default function AdminLayout() {
  const [activeSection, setActiveSection] = useState('overview');
  const [targetDate, setTargetDate] = useState(null);

  const navItems = [
    { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
    { id: 'daily', label: 'دورة الأيام (Daily Operations)', icon: Calendar },
    { id: 'trips', label: 'إدارة الرحلات', icon: Bus },
    { id: 'vehicles', label: 'المركبات (Cars & Buses)', icon: Car },
    { id: 'drivers', label: 'السائقون (Drivers)', icon: UserCheck },
    { id: 'routes', label: 'خطوط ومحطات السير والاتجاهات', icon: Navigation },
    { id: 'students', label: 'شؤون الطلاب', icon: Users },
    { id: 'reports', label: 'التقارير وتصدير البيانات', icon: FileSpreadsheet },
    { id: 'settings', label: 'إعدادات النظام', icon: Settings },
  ];

  const handleSelectDateFromDaily = (date) => {
    setTargetDate(date);
    setActiveSection('trips');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-64 bg-white rounded-3xl p-4 shadow-xs border border-slate-200 shrink-0">
          <div className="px-3 py-2 mb-2 border-b border-slate-100 flex items-center gap-2 text-slate-800">
            <Shield className="w-4 h-4 text-purple-600" />
            <span className="font-extrabold text-sm">لوحة الإدارة الرئيسية</span>
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    setTargetDate(null);
                  }}
                  className={`w-full text-right px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-purple-50 text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-purple-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronLeft className="w-3.5 h-3.5 text-purple-600 hidden lg:block" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 w-full overflow-hidden">
          {activeSection === 'overview' && (
            <AdminOverview onNavigate={(sec) => setActiveSection(sec)} />
          )}
          {activeSection === 'daily' && (
            <AdminDailyOperations onSelectDate={handleSelectDateFromDaily} />
          )}
          {activeSection === 'trips' && <AdminTrips defaultDate={targetDate} />}
          {activeSection === 'vehicles' && <AdminVehicles />}
          {activeSection === 'drivers' && <AdminDrivers />}
          {activeSection === 'routes' && <AdminRoutes />}
          {activeSection === 'students' && <AdminStudents />}
          {activeSection === 'reports' && <AdminReports />}
          {activeSection === 'settings' && <AdminSettings />}
        </main>
      </div>
    </div>
  );
}
