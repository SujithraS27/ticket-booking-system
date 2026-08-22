import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { endpoints } from '../api';
import { useAuth } from '../auth';
import type { Booking } from '../types';
import { formatDateTime, money } from '../types';

export function MyBookingsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string | null>(
    (location.state as { booked?: string } | null)?.booked ?? null,
  );

  async function load() {
    try {
      const res = await endpoints.myBookings();
      setBookings(res.bookings);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (user) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function cancel(id: string) {
    setError('');
    try {
      await endpoints.cancelBooking(id);
      setNotice('Booking cancelled. If the event was sold out, your seat was offered to the next person on the waitlist.');
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">My bookings</h1>

      {notice && (
        <div className="mb-4 rounded-md border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </div>
      )}
      {error && <div className="mb-4 rounded-md border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</div>}

      {bookings.length === 0 && <p className="text-slate-400">No bookings yet.</p>}

      <div className="space-y-4">
        {bookings.map((b) => (
          <article key={b.id} className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:flex-row">
            {b.status === 'CONFIRMED' && b.qrDataUrl ? (
              <img src={b.qrDataUrl} alt={`QR ticket ${b.reference}`} width={120} height={120} className="self-start rounded-lg border border-slate-700" />
            ) : (
              <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center self-start rounded-lg border border-dashed border-slate-700 text-xs text-slate-500">
                Cancelled
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                    b.status === 'CONFIRMED' ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {b.status}
                </span>
                <span className="font-mono text-sm text-indigo-300">{b.reference}</span>
              </div>
              <h2 className="text-lg font-semibold">{b.show.title}</h2>
              <p className="text-sm text-slate-400">
                {b.show.venue.name}, {b.show.venue.city} · {formatDateTime(b.show.startsAt)}
              </p>
              <p className="mt-1 text-sm text-slate-300">Seats: {b.seats.map((s) => s.label).join(', ')}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-semibold">{money(b.totalCents)}</span>
                {b.status === 'CONFIRMED' && (
                  <button
                    onClick={() => cancel(b.id)}
                    className="rounded-md border border-red-800 px-3 py-1 text-xs text-red-300 hover:bg-red-950"
                  >
                    Cancel booking
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}