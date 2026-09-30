import React, { useState } from 'react';
import { Home, Calendar, Clock, User, QrCode } from 'lucide-react';
import StudentHome from './StudentHome';
import StudentBookings from './StudentBookings';
import StudentHistory from './StudentHistory';
import StudentProfile from './StudentProfile';

export default function StudentView() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      {/* Main Tab Content */}
      <main className="px-4 py-5 max-w-3xl mx-auto w-full">
        {activeTab === 'home' && (
          <StudentHome onNavigateToBookings={() => setActiveTab('bookings')} />
        )}
        {activeTab === 'bookings' && (
          <StudentBookings onBookingCompleted={() => setActiveTab('home')} />
        )}
        {activeTab === 'history' && <StudentHistory />}
        {activeTab === 'profile' && <StudentProfile />}
      </main>

      {/* Mobile-First Bottom Navigation Bar */}
      <nav className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1 safe-area-bottom shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center py-2 px-3 rounded-2xl transition cursor-pointer ${
              activeTab === 'home' ? 'text-blue-600 font-black' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home className={`w-5 h-5 mb-0.5 ${activeTab === 'home' ? 'stroke-[2.5px]' : ''}`} />
            <span className="text-[11px]">الرئيسية</span>
          </button>

          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex flex-col items-center py-2 px-3 rounded-2xl transition cursor-pointer ${
              activeTab === 'bookings' ? 'text-blue-600 font-black' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar className={`w-5 h-5 mb-0.5 ${activeTab === 'bookings' ? 'stroke-[2.5px]' : ''}`} />
            <span className="text-[11px]">حجز رحلة</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center py-2 px-3 rounded-2xl transition cursor-pointer ${
              activeTab === 'history' ? 'text-blue-600 font-black' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Clock className={`w-5 h-5 mb-0.5 ${activeTab === 'history' ? 'stroke-[2.5px]' : ''}`} />
            <span className="text-[11px]">سجل حضوري</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center py-2 px-3 rounded-2xl transition cursor-pointer ${
              activeTab === 'profile' ? 'text-blue-600 font-black' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <User className={`w-5 h-5 mb-0.5 ${activeTab === 'profile' ? 'stroke-[2.5px]' : ''}`} />
            <span className="text-[11px]">حسابي</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
