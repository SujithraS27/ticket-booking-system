import { useEffect, useState } from 'react';
import { endpoints } from '../api';
import { Field, inputCls } from './LoginPage';
import type { ShowSummary, Venue } from '../types';
import { formatDateTime, money } from '../types';

interface StatsRow {
  showId: string;
  title: string;
  startsAt: string;
  venueName: string;
  capacity: number;
  bookedSeats: number;
  availableSeats: number;
  bookingsCount: number;
  revenueCents: number;
  ticketsSold: number;
  waitlistCount: number;
}

type StatsResponse = {
  rows?: StatsRow[];
  totals?: { shows: number; revenueCents: number; ticketsSold: number; bookingsCount: number };
};

export function OrganiserDashboardPage() {
  const [rows, setRows] = useState<StatsRow[]>([]);
  const [totals, setTotals] = useState<StatsResponse['totals'] | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [shows, setShows] = useState<ShowSummary[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [form, setForm] = useState({
    title: '',
    type: 'MOVIE',
    venueId: '',
    startsAt: '',
    premiumPrice: '2500',
    standardPrice: '1200',
  });

  async function loadAll() {
    try {
      const [statsRes, venuesRes, showsRes] = await Promise.all([
        endpoints.organiserStats(),
        endpoints.venues(),
        endpoints.listShows(),
      ]);
      if ('rows' in statsRes) {
        setRows(statsRes.rows ?? []);
        setTotals(statsRes.totals ?? null);
      }
      setVenues(venuesRes.venues);
      setShows(showsRes.shows);
      setForm((f) => ({ ...f, venueId: f.venueId || venuesRes.venues[0]?.id || '' }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createShow(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      await fetch('/api/shows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('tbs.token')}`,
        },
        body: JSON.stringify({
          title: form.title,
          type: form.type,
          venueId: form.venueId,
          startsAt: new Date(form.startsAt).toISOString(),
          premiumPriceCents: Math.round(Number(form.premiumPrice) * 100),
          standardPriceCents: Math.round(Number(form.standardPrice) * 100),
        }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          throw new Error(body?.error?.message ?? `Failed (${r.status})`);
        }
      });
      setNotice(`Show "${form.title}" created.`);
      setForm({ ...form, title: '' });
      await loadAll();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Organiser dashboard</h1>
      <p className="mb-6 text-slate-400">Create event listings and track booking summary + revenue per show.</p>

      {error && <div className="mb-4 rounded-md border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</div>}
      {notice && <div className="mb-4 rounded-md border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">{notice}</div>}

      {totals && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Shows" value={String(totals.shows)} />
          <Stat label="Bookings" value={String(totals.bookingsCount)} />
          <Stat label="Tickets sold" value={String(totals.ticketsSold)} />
          <Stat label="Revenue" value={money(totals.revenueCents)} />
        </div>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Booking summary &amp; revenue</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[760px] bg-slate-900 text-sm">
            <thead className="bg-slate-800/70 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2.5">Event</th>
                <th className="px-4 py-2.5">Venue</th>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Capacity</th>
                <th className="px-4 py-2.5">Booked</th>
                <th className="px-4 py-2.5">Available</th>
                <th className="px-4 py-2.5">Bookings</th>
                <th className="px-4 py-2.5">Waitlist</th>
                <th className="px-4 py-2.5 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.showId} className="border-t border-slate-800">
                  <td className="px-4 py-2.5 font-medium">{r.title}</td>
                  <td className="px-4 py-2.5 text-slate-400">{r.venueName}</td>
                  <td className="px-4 py-2.5 text-slate-400">{formatDateTime(r.startsAt)}</td>
                  <td className="px-4 py-2.5">{r.capacity}</td>
                  <td className="px-4 py-2.5">{r.bookedSeats}</td>
                  <td className="px-4 py-2.5">{r.availableSeats}</td>
                  <td className="px-4 py-2.5">{r.bookingsCount} ({r.ticketsSold} tickets)</td>
                  <td className="px-4 py-2.5">{r.waitlistCount}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">{money(r.revenueCents)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-500">No shows yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="max-w-xl">
        <h2 className="mb-3 text-lg font-semibold">Create an event</h2>
        <form onSubmit={createShow} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <Field label="Title">
            <input required minLength={2} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
                <option value="MOVIE">Movie</option>
                <option value="CONCERT">Concert</option>
              </select>
            </Field>
            <Field label="Venue">
              <select required value={form.venueId} onChange={(e) => setForm({ ...form, venueId: e.target.value })} className={inputCls}>
                <option value="">— select —</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.city})
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Starts at">
            <input
              required
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Premium price">
              <input type="number" min={1} step="0.01" value={form.premiumPrice} onChange={(e) => setForm({ ...form, premiumPrice: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Standard price">
              <input type="number" min={1} step="0.01" value={form.standardPrice} onChange={(e) => setForm({ ...form, standardPrice: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <button className="w-full rounded-md bg-indigo-600 py-2 font-semibold hover:bg-indigo-500">Create listing</button>
        </form>

        <h2 className="mb-3 mt-8 text-lg font-semibold">Your listings</h2>
        <div className="space-y-2">
          {shows.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
              <span className="font-medium">{s.title}</span>{' '}
              <span className="text-slate-500">· {s.type} · {formatDateTime(s.startsAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}
