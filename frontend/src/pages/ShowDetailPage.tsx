import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { endpoints } from '../api';
import { useAuth } from '../auth';
import { useSeatUpdates } from '../socket';
import { Countdown } from '../components/Countdown';
import { SeatMap } from '../components/SeatMap';
import type { Seat, SeatCategory } from '../types';
import { money } from '../types';

/**
 * Event page: live visual seat map (Socket.IO), seat selection with a
 * backend-enforced hold + countdown, checkout, and waitlist sign-up when
 * the category is sold out.
 */
export function ShowDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hold, setHold] = useState<{ expiresAt: string; seatIds: string[] } | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  // Live updates pushed over Socket.IO
  const liveSeats = useSeatUpdates(id);

  useEffect(() => {
    if (liveSeats.length === 0) return;
    setSeats((prev) =>
      prev.map((s) => {
        const upd = liveSeats.find((u) => u.id === s.id);
        return upd ? { ...s, ...upd } : s;
      }),
    );
    setSelected((prev) => {
      const next = new Set(prev);
      for (const u of liveSeats) {
        if (next.has(u.id) && !(u.status === 'AVAILABLE' || u.heldByMe)) next.delete(u.id);
      }
      return next;
    });
  }, [liveSeats]);

  useEffect(() => {
    endpoints
      .seatMap(id)
      .then((r) => setSeats(r.seats))
      .catch((e) => setError(e.message));
  }, [id]);

  const selectedTotal = useMemo(
    () => seats.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + s.priceCents, 0),
    [seats, selected],
  );
  function toggle(seat: Seat) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else next.add(seat.id);
      return next;
    });
  }

  async function startCheckout() {
    setError('');
    setInfo('');
    if (!user) {
      navigate('/login');
      return;
    }
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await endpoints.holdSeats(id, [...selected]);
      setHold({ expiresAt: res.expiresAt, seatIds: [...selected] });
    } catch (e) {
      setError((e as Error).message);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  const releaseHold = useCallback(async () => {
    if (!hold) return;
    try {
      await endpoints.releaseHolds(id, hold.seatIds);
    } catch {
      /* the TTL will release them anyway */
    }
    setHold(null);
    setSelected(new Set());
  }, [id, hold]);

  async function confirmBooking() {
    if (!hold) return;
    setError('');
    setBusy(true);
    try {
      const res = await endpoints.book(id, hold.seatIds);
      navigate('/bookings', { state: { booked: res.booking.reference } });
    } catch (e) {
      setError((e as Error).message);
      setHold(null);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function joinWaitlist(category: SeatCategory) {
    setError('');
    setInfo('');
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await endpoints.joinWaitlist(id, category);
      setInfo(`You are on the waitlist for ${category.toLowerCase()} seats. We will email you when one frees up.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const categoryFull = (category: SeatCategory) =>
    seats.filter((s) => s.category === category).length > 0 &&
    seats.every((s) => s.category !== category || s.status !== 'AVAILABLE');

  const categories: SeatCategory[] = ['PREMIUM', 'STANDARD'];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Select your seats</h1>
      <p className="mb-6 text-slate-400">
        Seats you select are held for 10 minutes while you check out. The map updates in real time.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</div>
      )}
      {info && (
        <div className="mb-4 rounded-md border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">{info}</div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <SeatMap seats={seats} selected={selected} onToggle={toggle} />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-5">
          <div>
            <p className="text-sm text-slate-400">
              {selected.size} seat{selected.size === 1 ? '' : 's'} ·{' '}
              <span className="font-semibold text-white">{money(selectedTotal)}</span>
            </p>
            {categories.map((c) => (
              <span key={c} className="mr-3 text-xs text-slate-500">
                {c}: {money(seats.find((s) => s.category === c)?.priceCents ?? 0)}
                {categoryFull(c) && (
                  <>
                    {' · '}
                    <button onClick={() => joinWaitlist(c)} className="text-indigo-400 hover:underline">
                      Sold out — join waitlist
                    </button>
                  </>
                )}
              </span>
            ))}
          </div>

          {!hold ? (
            <button
              disabled={busy || selected.size === 0}
              onClick={startCheckout}
              className="rounded-lg bg-indigo-600 px-6 py-2.5 font-semibold hover:bg-indigo-500 disabled:opacity-40"
            >
              Hold seats &amp; continue
            </button>
          ) : (
            <div className="flex items-center gap-4 rounded-lg border border-indigo-700 bg-indigo-950/60 px-4 py-2.5">
              <span className="text-sm text-slate-300">
                Seats held — expires in{' '}
                <Countdown
                  expiresAt={hold.expiresAt}
                  onExpire={() => {
                    setHold(null);
                    setSelected(new Set());
                    setError('Your hold expired. Please select seats again.');
                  }}
                />
              </span>
              <button
                disabled={busy}
                onClick={confirmBooking}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold hover:bg-emerald-500"
              >
                Confirm booking
              </button>
              <button disabled={busy} onClick={releaseHold} className="text-xs text-slate-400 hover:text-white">
                Abandon
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
