import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Bus,
  CheckCircle,
  Users,
  AlertCircle,
  X,
  Check,
  ChevronLeft,
} from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function StudentBookings({ onBookingCompleted }) {
  const { showToast } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to tomorrow or today
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const d = String(tomorrow.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [loading, setLoading] = useState(false);
  const [tripsData, setTripsData] = useState({ trips: [], formatted_date: '', max_booking_date: '', existing_booking: null });
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedPickup, setSelectedPickup] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  const fetchTrips = async (date) => {
    try {
      setLoading(true);
      const res = await api.get(`/student/available-trips?date=${date}`);
      if (res.success) {
        setTripsData(res);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحميل الرحلات المتاحة.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips(selectedDate);
  }, [selectedDate]);

  const handleBook = async () => {
    if (!selectedTrip || !selectedPickup) {
      showToast('يرجى تحديد الرحلة ونقطة الركوب.', 'error');
      return;
    }

    try {
      setBookingLoading(true);
      const res = await api.post('/student/book', {
        trip_id: selectedTrip.id,
        pickup_point_id: selectedPickup,
      });

      if (res.success) {
        showToast(res.message || 'تم تأكيد حجزك بنجاح!', 'success');
        setSelectedTrip(null);
        setSelectedPickup('');
        await fetchTrips(selectedDate);
        if (onBookingCompleted) {
          onBookingCompleted();
        }
      }
    } catch (err) {
      showToast(err.message || 'فشل إجراء الحجز.', 'error');
    } finally {
      setBookingLoading(false);
    }
  };

  // Helper date buttons
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  return (
    <div className="space-y-5 pb-8 animate-fade-in max-w-xl mx-auto">
      {/* Date Switcher */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200">
        <div className="text-xs font-bold text-slate-400 mb-2.5">اختر تاريخ الرحلة:</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSelectedDate(todayStr)}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedDate === todayStr
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>رحلات اليوم</span>
          </button>

          <button
            onClick={() => setSelectedDate(tomorrowStr)}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedDate === tomorrowStr
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>حجز رحلة الغد</span>
          </button>
        </div>

        <div className="mt-2 text-center text-xs text-blue-600 font-bold">
          {tripsData.formatted_date || selectedDate}
        </div>
        <label className="block mt-3 text-xs font-semibold text-slate-500">
          أو اختر تاريخاً آخر ضمن فترة الحجز:
          <input
            type="date"
            min={todayStr}
            max={tripsData.max_booking_date || undefined}
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="block w-full mt-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800"
          />
        </label>
        {tripsData.existing_booking && (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            لديك حجز مؤكد لهذا التاريخ: <strong>{tripsData.existing_booking.route_name}</strong>، {tripsData.existing_booking.departure_time}. ألغِ الحجز الحالي من سجل حضورك إذا أردت اختيار رحلة أخرى.
          </div>
        )}
      </div>

      {/* Trips List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">جاري البحث عن الرحلات المتاحة...</p>
        </div>
      ) : tripsData.trips.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Bus className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-700 text-base">لا توجد رحلات مجدولة لهذا التاريخ</h3>
          <p className="text-xs text-slate-400 mt-1">
            يرجى مراجعة إدارة النقل أو اختيار موعد آخر.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tripsData.trips.map((trip) => {
            const isFull = trip.is_full;
            const occupancyPct = Math.round((trip.booked_seats / trip.capacity) * 100);

            return (
              <div
                key={trip.id}
                className={`bg-white rounded-3xl p-5 shadow-xs border transition-all ${
                  isFull ? 'border-slate-200 opacity-70' : 'border-slate-200 hover:border-blue-400 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 block mb-0.5">
                      كود الرحلة: {trip.trip_code}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base leading-tight">
                      {trip.route_name}
                    </h3>
                  </div>

                  {isFull ? (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                      مكتملة (FULL)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                      متاح {trip.available_seats} مقاعد
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-3">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>الانطلاق: <strong>{trip.departure_time} صباحاً</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Bus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>المركبة: <strong>{trip.vehicle_number}</strong></span>
                  </div>
                </div>

                {/* Seat Capacity Progress Meter */}
                <div className="mb-4">
                  <div className="flex justify-between text-[11px] text-slate-500 font-semibold mb-1">
                    <span>نسبة الإشغال:</span>
                    <span>{trip.booked_seats} من أصل {trip.capacity} مقعد ({occupancyPct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isFull
                          ? 'bg-rose-500'
                          : occupancyPct > 80
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, occupancyPct)}%` }}
                    />
                  </div>
                </div>

                {/* Booking Button */}
                <button
                  disabled={isFull || Boolean(tripsData.existing_booking)}
                  onClick={() => {
                    setSelectedTrip(trip);
                    setSelectedPickup(trip.pickups[0]?.id || '');
                  }}
                  className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                    isFull || tripsData.existing_booking
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 active:scale-98 cursor-pointer'
                  }`}
                >
                  <span>{tripsData.existing_booking ? 'لديك حجز مؤكد بالفعل' : isFull ? 'الرحلة ممتلئة بالكامل' : 'حجز مقعد في هذه الرحلة'}</span>
                  {!isFull && !tripsData.existing_booking && <ChevronLeft className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Booking Confirmation Modal */}
      {selectedTrip && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setSelectedTrip(null)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Bus className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-center text-slate-900">
              تأكيد حجز مقعدك
            </h3>
            <p className="text-xs text-slate-500 text-center mt-0.5 mb-4">
              {selectedTrip.route_name} • {selectedDate}
            </p>

            <div className="space-y-3 mb-5">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">وقت الانطلاق:</span>
                  <strong className="text-slate-800">{selectedTrip.departure_time} صباحاً</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">المركبة:</span>
                  <span className="text-slate-800 font-semibold">{selectedTrip.vehicle_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">السائق:</span>
                  <span className="text-slate-800 font-semibold">{selectedTrip.driver_name}</span>
                </div>
              </div>

              {/* Pickup point dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  حدد نقطة ركوبك في هذه الرحلة:
                </label>
                <select
                  value={selectedPickup}
                  onChange={(e) => setSelectedPickup(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {selectedTrip.pickups.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.expected_time_offset_min > 0 ? `(+${p.expected_time_offset_min} دقيقة)` : '(محطة البداية)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedTrip(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleBook}
                disabled={bookingLoading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {bookingLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تأكيد الحجز النهائي</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
