import { useEffect, useState } from 'react';
import { endpoints } from '../api';
import { Field, inputCls } from './LoginPage';
import type { Venue } from '../types';

export function AdminVenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [rows, setRows] = useState(8);
  const [seatsPerRow, setSeatsPerRow] = useState(12);
  const [premiumRows, setPremiumRows] = useState(2);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    const res = await endpoints.venues();
    setVenues(res.venues);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      await endpoints.createVenue({ name, city, rows, seatsPerRow, premiumRows });
      setNotice(`Venue "${name}" created with ${rows * seatsPerRow} seats.`);
      setName('');
      setCity('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Venue management</h1>
      <p className="mb-6 text-slate-400">Admins define venues with a seat layout and per-row seat categories.</p>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <Field label="Venue name">
            <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="City">
            <input required minLength={2} value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Rows">
              <input type="number" min={1} max={60} value={rows} onChange={(e) => setRows(Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Seats / row">
              <input type="number" min={1} max={40} value={seatsPerRow} onChange={(e) => setSeatsPerRow(Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Premium rows">
              <input type="number" min={0} max={60} value={premiumRows} onChange={(e) => setPremiumRows(Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {notice && <p className="text-sm text-emerald-400">{notice}</p>}
          <button className="w-full rounded-md bg-indigo-600 py-2 font-semibold hover:bg-indigo-500">Create venue</button>
        </form>

        <div className="space-y-3">
          {venues.map((v) => (
            <div key={v.id} className="rounded-lg border border-slate-800 bg-slate-900 px-5 py-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{v.name}</h3>
                <span className="text-xs uppercase text-slate-500">{v.city}</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {v.rows} rows × {v.seatsPerRow} seats · {v.premiumRows} premium row(s) ·{' '}
                {(v._count?.seats ?? v.rows * v.seatsPerRow)} total seats
              </p>
            </div>
          ))}
          {venues.length === 0 && <p className="text-slate-400">No venues yet.</p>}
        </div>
      </div>
    </main>
  );
}