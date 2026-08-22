import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { endpoints, getToken } from '../api';
import type { OfferInfo } from '../types';
import { formatDateTime, money } from '../types';

/** Landing page for the time-limited waitlist offer link from the email. */
export function OfferPage() {
  const { token = '' } = useParams();
  const [offer, setOffer] = useState<OfferInfo | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ reference: string; qrDataUrl: string; seats: string[] } | null>(null);

  useEffect(() => {
    endpoints
      .offerInfo(token)
      .then((r) => setOffer(r.offer))
      .catch((e) => setError(e.message));
  }, [token]);

  async function accept() {
    setError('');
    try {
      const res = await endpoints.acceptOffer(token);
      setResult({
        reference: res.reference,
        qrDataUrl: res.qrDataUrl,
        seats: res.seats.map((s) => s.label),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function decline() {
    setError('');
    try {
      await endpoints.declineOffer(token);
      setOffer(null);
      setOffer({ ...(offer as OfferInfo), status: 'EXPIRED' });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (result) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold text-emerald-400">Seat confirmed! 🎉</h1>
        <img src={result.qrDataUrl} alt="QR ticket" className="mx-auto mb-4 rounded-lg border border-slate-700" />
        <p className="font-mono text-indigo-300">{result.reference}</p>
        <p className="mt-2 text-slate-400">Seats: {result.seats.join(', ')}</p>
        <Link to="/bookings" className="mt-6 inline-block rounded-md bg-indigo-600 px-5 py-2 font-semibold hover:bg-indigo-500">
          View my bookings
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="mb-3 text-xl font-semibold text-red-400">Offer unavailable</h1>
        <p className="text-slate-400">{error}</p>
      </main>
    );
  }

  if (!offer) return <main className="p-16 text-center text-slate-400">Loading offer…</main>;

  const expired = offer.status === 'EXPIRED' || new Date(offer.expiresAt).getTime() <= Date.now();
  const loggedIn = !!getToken();

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-xl border border-fuchsia-800/60 bg-slate-900 p-6 text-center">
        <p className="text-xs uppercase tracking-widest text-fuchsia-400">Time-limited waitlist offer</p>
        <h1 className="mt-2 text-xl font-bold">{offer.show.title}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {offer.show.venue.name}, {offer.show.venue.city} · {formatDateTime(offer.show.startsAt)}
        </p>

        <div className="my-5 rounded-lg bg-slate-950 p-4">
          <p className="text-sm text-slate-300">
            Seat <strong className="text-white">{offer.seat.label}</strong> ({offer.seat.category}) —{' '}
            <strong className="text-white">{money(offer.seat.priceCents)}</strong>
          </p>
          <p className={`mt-1 text-sm ${expired ? 'text-red-400' : 'text-amber-300'}`}>
            {expired ? 'This offer has expired.' : `Expires: ${formatDateTime(offer.expiresAt)}`}
          </p>
        </div>

        {expired ? (
          <p className="text-sm text-slate-400">
            The seat has been passed to the next person on the waitlist. You can join the waitlist again from the event page.
          </p>
        ) : (
          <>
            {!loggedIn && (
              <p className="mb-4 text-sm text-amber-300">
                This offer belongs to a specific account.{' '}
                <Link to="/login" className="underline">
                  Log in
                </Link>{' '}
                with that account first.
              </p>
            )}
            <div className="flex justify-center gap-3">
              <button
                onClick={accept}
                disabled={!loggedIn}
                className="rounded-md bg-emerald-600 px-5 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-40"
              >
                Accept &amp; get ticket
              </button>
              <button
                onClick={decline}
                disabled={!loggedIn}
                className="rounded-md border border-slate-700 px-5 py-2 text-sm hover:bg-slate-800 disabled:opacity-40"
              >
                Decline
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">If you decline or the timer runs out, the seat moves to the next customer.</p>
          </>
        )}
      </div>
    </main>
  );
}