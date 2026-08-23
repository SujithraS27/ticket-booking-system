import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { endpoints } from '../api';
import { posterUrl } from '../lib/images';
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
      <h1 className="mb-1 text-2xl font-bold text-white">My bookings</h1>
      <p className="mb-6 text-sm text-slate-400">Your tickets, always in your pocket.</p>

      {notice && (
        <div className="mb-4 rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </div>
      )}
      {error && <div className="mb-4 rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</div>}

      {bookings.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-12 text-center">
          <p className="text-4xl">🎫</p>
          <p className="mt-3 text-slate-400">No bookings yet.</p>
        </div>
      )}

      <div className="space-y-6">
        {bookings.map((b) => (
          <TicketCard key={b.id} booking={b} onCancel={cancel} />
        ))}
      </div>
    </main>
  );
}

function TicketCard({ booking: b, onCancel }: { booking: Booking; onCancel: (id: string) => void }) {
  const isActive = b.status === 'CONFIRMED';
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900 to-slate-950 shadow-xl">
      {/* ticket header strip */}
      <div
        className="relative h-28 w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${posterUrl(b.show.title)})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20" />
        <div className="absolute bottom-2 left-4 right-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-600/40 text-slate-300'
              }`}
            >
              {b.status}
            </span>
            <h2 className="mt-1 text-lg font-extrabold text-white drop-shadow">{b.show.title}</h2>
          </div>
          <span className="font-mono text-xs text-indigo-300">{b.reference}</span>
        </div>
      </div>

      {/* ticket body */}
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-300">
            {b.show.venue.name}, {b.show.venue.city}
          </p>
          <p className="mt-1 text-xs text-slate-400">{formatDateTime(b.show.startsAt)}</p>
          <p className="mt-2 text-sm font-semibold text-white">Seats: {b.seats.map((s) => s.label).join(', ')}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-lg font-extrabold text-emerald-400">{money(b.totalCents)}</span>
            {isActive && (
              <button
                onClick={() => onCancel(b.id)}
                className="rounded-lg border border-red-800/80 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-950"
              >
                Cancel booking
              </button>
            )}
          </div>
        </div>

        {/* QR side */}
        <div className="flex shrink-0 flex-col items-center justify-center">
          {b.qrDataUrl ? (
            <div className="rounded-xl bg-white p-2 shadow-lg">
              <img src={b.qrDataUrl} alt={`QR ticket ${b.reference}`} width={112} height={112} className="h-28 w-28" />
            </div>
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-slate-600 text-xs text-slate-500">
              {isActive ? 'QR' : 'Cancelled'}
            </div>
          )}
          <p className="mt-1.5 text-[10px] uppercase tracking-widest text-slate-500">Scan at entry</p>
        </div>
      </div>

      {/* perforation edge */}
      <div className="flex justify-around border-t border-slate-800 px-4 py-2">
        <span className="relative flex h-3 w-3 rounded-full bg-slate-600" />
        <span className="relative flex h-3 w-3 rounded-full bg-slate-600" />
        <span className="relative flex h-3 w-3 rounded-full bg-slate-600" />
      </div>
    </article>
  );
}