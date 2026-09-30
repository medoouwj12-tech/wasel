import React, { Suspense, lazy } from 'react';
import { useAuth } from './context/AuthContext';
import Header from './components/common/Header';
import PWAInstallBanner from './components/common/PWAInstallBanner';
import NotificationToast from './components/common/NotificationToast';
import AuthPage from './components/auth/AuthPage';

const StudentView = lazy(() => import('./components/student/StudentView'));
const DriverView = lazy(() => import('./components/driver/DriverView'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));

function RoleViewLoading() {
  return (
    <div className="min-h-48 flex items-center justify-center p-6 text-sm text-slate-500" role="status">
      <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin ml-3" />
      جاري تحميل الصفحة...
    </div>
  );
}

export default function App() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold text-slate-800">واصل | نقل وحضور الطلاب</h2>
        <p className="text-xs text-slate-400 mt-1">جاري تحميل التطبيق والتحقق من الجلسة...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthPage />
        <NotificationToast />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* 1. PWA Install Banner */}
      <PWAInstallBanner />

      {/* 2. Top Header Navigation */}
      <Header />

      {/* 3. Role-Based Views */}
      <div className="flex-1">
        <Suspense fallback={<RoleViewLoading />}>
          {role === 'STUDENT' && <StudentView />}
          {role === 'DRIVER' && <DriverView />}
          {role === 'ADMIN' && <AdminLayout />}
        </Suspense>
      </div>

      {/* 4. Global Toast Notifications */}
      <NotificationToast />
    </div>
  );
}
