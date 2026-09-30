import React, { useState, useEffect, useRef } from 'react';
import {
  Bus,
  QrCode,
  Users,
  CheckCircle2,
  XCircle,
  Phone,
  Clock,
  MapPin,
  Check,
  Camera,
  RefreshCw,
  Award,
  AlertCircle,
  Flag,
  Play,
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function DriverView() {
  const { user, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('manifest'); // 'manifest' | 'scanner'

  // Scanner state
  const [manualQRInput, setManualQRInput] = useState('');
  const [scannedResult, setScannedResult] = useState(null);
  const scannerRef = useRef(null);
  const scanInFlightRef = useRef(false);
  const lastScanAttemptRef = useRef({ token: '', at: 0 });

  // Fetch driver assigned trips
  const fetchTrips = async () => {
    try {
      setLoading(true);
      const res = await api.get('/driver/trips');
      if (res.success && res.trips) {
        setTrips(res.trips);
        setActiveTrip((current) => res.trips.find((trip) => trip.id === current?.id) || res.trips[0] || null);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل رحلات السائق.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  // Fetch passenger manifest when activeTrip changes
  const fetchManifest = async (tripId) => {
    if (!tripId) return;
    try {
      setManifestLoading(true);
      const res = await api.get(`/driver/trip/${tripId}/manifest`);
      if (res.success) {
        setManifest(res);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل قائمة الركاب.', 'error');
    } finally {
      setManifestLoading(false);
    }
  };

  useEffect(() => {
    if (activeTrip) {
      fetchManifest(activeTrip.id);
    }
  }, [activeTrip]);

  // Set up camera QR scanner when scanner tab is opened
  useEffect(() => {
    if (activeTab === 'scanner' && activeTrip) {
      const qrScanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        false
      );

      qrScanner.render(
        async (decodedText) => {
          handleQRScan(decodedText);
        },
        (error) => {
          // ignore minor scan frame misses
        }
      );

      scannerRef.current = qrScanner;

      return () => {
        qrScanner.clear().catch(console.error);
      };
    }
  }, [activeTab, activeTrip]);

  // Handle scanned QR code
  const handleQRScan = async (codeText) => {
    const now = Date.now();
    if (scanInFlightRef.current || (lastScanAttemptRef.current.token === codeText && now - lastScanAttemptRef.current.at < 2500)) {
      return;
    }
    scanInFlightRef.current = true;
    lastScanAttemptRef.current = { token: codeText, at: now };
    try {
      const res = await api.post('/driver/scan-qr', {
        qr_token: codeText,
        trip_id: activeTrip?.id,
      });

      if (res.success) {
        setScannedResult({
          success: true,
          student: res.student,
          message: res.message,
        });
        showToast(res.message, 'success');
        // Refresh manifest & trip counters
        fetchManifest(activeTrip.id);
        fetchTrips();
      }
    } catch (err) {
      setScannedResult({
        success: false,
        message: err.message || 'فشل التحقق من رمز QR.',
        student: err.data?.student || null,
      });
      showToast(err.message || 'رمز QR غير صالح.', 'error');
    } finally {
      scanInFlightRef.current = false;
    }
  };

  // Toggle manual attendance check-in
  const handleToggleAttendance = async (bookingId) => {
    try {
      const res = await api.post('/driver/toggle-attendance', { booking_id: bookingId });
      if (res.success) {
        showToast(res.message, 'success');
        fetchManifest(activeTrip.id);
        fetchTrips();
      }
    } catch (err) {
      showToast(err.message || 'فشل تغيير حالة الحضور.', 'error');
    }
  };

  // Finish Trip
  const handleStartTrip = async () => {
    try {
      const res = await api.post(`/driver/trip/${activeTrip.id}/start`, {});
      if (res.success) {
        showToast(res.message, 'success');
        await fetchTrips();
      }
    } catch (err) {
      showToast(err.message || 'فشل بدء الرحلة.', 'error');
    }
  };

  const handleFinishTrip = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إنهاء الرحلة الحالية واكتمال وصول الطلاب؟')) {
      return;
    }
    try {
      const res = await api.post(`/driver/trip/${activeTrip.id}/finish`, {});
      if (res.success) {
        showToast(res.message, 'success');
        fetchTrips();
      }
    } catch (err) {
      showToast(err.message || 'فشل إنهاء الرحلة.', 'error');
    }
  };

  if (loading && !trips.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs">جاري تحميل رحلات السائق...</p>
      </div>
    );
  }

  const tripStats = manifest?.trip || activeTrip;

  return (
    <div className="px-4 py-5 max-w-3xl mx-auto space-y-5 pb-12 animate-fade-in">
      {/* 1. Driver Welcome & Trip Summary Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold block">لوحة تحكم السائق / المشرف</span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                {activeTrip ? activeTrip.route_name : 'لا توجد رحلة معينة حالياً'}
              </h2>
            </div>
          </div>

          {activeTrip && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-mono font-bold text-slate-200">
                {activeTrip.vehicle_number} ({activeTrip.plate_number})
              </span>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold">
                انطلاق {activeTrip.departure_time}
              </span>
            </div>
          )}
        </div>

        {/* Real-time KPI Counters (Bookings, Present, Absent) */}
        {tripStats && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <span className="text-[11px] text-slate-300 font-bold block mb-1">إجمالي الحجوزات</span>
              <span className="text-xl sm:text-2xl font-black text-white">
                {tripStats.booked_count ?? tripStats.booked_seats}
              </span>
            </div>

            <div className="bg-emerald-500/20 backdrop-blur-md rounded-2xl p-3 border border-emerald-500/30">
              <span className="text-[11px] text-emerald-300 font-bold block mb-1">الحاضرون (صعدوا)</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">
                {tripStats.present_count || 0}
              </span>
            </div>

            <div className="bg-rose-500/20 backdrop-blur-md rounded-2xl p-3 border border-rose-500/30">
              <span className="text-[11px] text-rose-300 font-bold block mb-1">{tripStats.status === 'COMPLETED' ? 'الغياب' : 'لم يسجلوا بعد'}</span>
              <span className="text-xl sm:text-2xl font-black text-rose-400">
                {tripStats.absent_count || 0}
              </span>
            </div>
          </div>
        )}
      </div>

      {activeTrip?.status === 'SCHEDULED' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          ابدأ الرحلة أولاً لتفعيل مسح رموز الصعود وتسجيل الحضور.
        </div>
      )}

      {/* 2. Driver Mode Tabs: Manifest List vs QR Scanner */}
      <div className="flex bg-slate-200/80 p-1.5 rounded-2xl gap-1">
        <button
          onClick={() => setActiveTab('manifest')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === 'manifest'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-blue-600" />
          <span>قائمة الركاب والمحطات ({manifest?.passengers?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('scanner')}
          disabled={activeTrip?.status !== 'IN_TRANSIT'}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
            activeTab === 'scanner'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <QrCode className="w-4 h-4 text-amber-600" />
          <span>كاميرا فحص الـ QR (Scan)</span>
        </button>
      </div>

      {/* 3. TAB CONTENT: QR Scanner */}
      {activeTab === 'scanner' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 text-center">
            <h3 className="font-bold text-slate-800 text-base mb-1">
              مسح رمز QR للراكب بالكاميرا
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              وجه كاميرا الهاتف نحو شاشة هاتف الطالب لمسح الكود وتسجيل حضوره فوراً
            </p>

            {/* Html5Qrcode Scanner Target Viewport */}
            <div className="max-w-xs mx-auto overflow-hidden rounded-2xl border-2 border-slate-200 shadow-inner bg-slate-950">
              <div id="qr-reader" className="w-full"></div>
            </div>

            {/* Manual QR / Booking Code Fallback Input */}
            <div className="mt-5 pt-4 border-t border-slate-100 max-w-sm mx-auto">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 text-right">
                أو إدخال رمز الصعود يدوياً:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualQRInput}
                  onChange={(e) => setManualQRInput(e.target.value)}
                  placeholder="أدخل الرمز الموجود داخل QR"
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={() => {
                    if (manualQRInput.trim()) {
                      handleQRScan(manualQRInput.trim());
                      setManualQRInput('');
                    }
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                >
                  تحقق
                </button>
              </div>
            </div>
          </div>

          {/* Last Scanned Result Banner */}
          {scannedResult && (
            <div
              className={`rounded-3xl p-5 shadow-lg border transition-all ${
                scannedResult.success
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shrink-0 ${
                    scannedResult.success ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  {scannedResult.success ? '✓' : '!'}
                </div>
                <div className="flex-1">
                  <h4 className="font-extrabold text-sm">{scannedResult.message}</h4>
                  {scannedResult.student && (
                    <div className="mt-2 text-xs space-y-0.5 opacity-90">
                      <div>
                        اسم الطالب: <strong>{scannedResult.student.name}</strong> ({scannedResult.student.code})
                      </div>
                      <div>نقطة الركوب: {scannedResult.student.pickup_name}</div>
                      <div>وقت التسجيل: {scannedResult.student.checked_in_at}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB CONTENT: Passenger Manifest & Pickup Points */}
      {activeTab === 'manifest' && (
        <div className="space-y-4 animate-fade-in">
          {manifestLoading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">جاري تحميل قائمة الطلاب...</p>
            </div>
          ) : !manifest?.passengers?.length ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-bold text-slate-700 text-sm">لا توجد حجوزات مؤكدة لهذه الرحلة</h3>
            </div>
          ) : (
            <div className="space-y-3">
              {manifest.passengers.map((passenger) => {
                const isPresent = passenger.is_present;
                return (
                  <div
                    key={passenger.booking_id}
                    className={`bg-white rounded-3xl p-4 sm:p-5 shadow-xs border transition-all ${
                      isPresent ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Student Info */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            isPresent
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isPresent ? '✓' : passenger.student_name.charAt(0)}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 text-sm">
                              {passenger.student_name}
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400">
                              {passenger.booking_code}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-rose-500" />
                              <strong>{passenger.pickup_name}</strong>
                            </span>
                            {passenger.student_phone && (
                              <a
                                href={`tel:${passenger.student_phone}`}
                                className="text-blue-600 hover:underline flex items-center gap-0.5 mr-2"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{passenger.student_phone}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Manual Attendance Toggle Button */}
                      <button
                        onClick={() => handleToggleAttendance(passenger.booking_id)}
                        disabled={activeTrip?.status !== 'IN_TRANSIT'}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                          isPresent
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isPresent ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>حاضر ✓</span>
                          </>
                        ) : (
                          <span>تسجيل صعود</span>
                        )}
                      </button>
                    </div>

                    {isPresent && passenger.checked_in_at && (
                      <div className="mt-2 pt-2 border-t border-emerald-100/60 text-[11px] text-emerald-700 text-right">
                        تم تسجيل الحضور في تمام: {passenger.checked_in_at} ({passenger.attendance_method})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Complete / Finish Trip Action */}
          {activeTrip?.status === 'SCHEDULED' && (
            <div className="pt-4">
              <button
                onClick={handleStartTrip}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>بدء الرحلة وتفعيل تسجيل الصعود</span>
              </button>
            </div>
          )}
          {activeTrip?.status === 'IN_TRANSIT' && (
            <div className="pt-4">
              <button
                onClick={handleFinishTrip}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Flag className="w-4 h-4 text-emerald-400" />
                <span>إنهاء الرحلة الحالية واكتمال الوصول</span>
              </button>
            </div>
          )}
          {activeTrip?.status === 'COMPLETED' && (
            <div className="pt-4 text-center text-xs font-bold text-emerald-700">اكتملت الرحلة</div>
          )}
        </div>
      )}
    </div>
  );
}
