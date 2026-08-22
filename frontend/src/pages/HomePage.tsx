import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { endpoints } from '../api';
import { formatDateTime, money, type ShowSummary } from '../types';

export function HomePage() {
  const [shows, setShows] = useState<ShowSummary[]>([]);
  const [type, setType] = useState('');
  const [city, setCity] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    if (city) params.city = city;
    if (search) params.search = search;
    endpoints
      .listShows(params)
      .then((r) => setShows(r.shows))
      .catch((e) => setError(e.message));
  }, [type, city, search]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Browse events</h1>
      <p className="mb-6 text-slate-400">Pick an event, choose seats on the live map, and book in seconds.</p>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          placeholder="Search title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="MOVIE">Movies</option>
          <option value="CONCERT">Concerts</option>
        </select>
        <input
          placeholder="Filter by city…"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-44 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
      </div>

      {error && <p className="text-red-400">{error}</p>}
      {shows.length === 0 && !error && <p className="text-slate-400">No events found.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shows.map((show) => (
          <Link
            key={show.id}
            to={`/shows/${show.id}`}
            className="group rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-indigo-500"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-300">
                {show.type}
              </span>
              <span className="text-xs text-slate-500">{formatDateTime(show.startsAt)}</span>
            </div>
            <h2 className="mb-1 text-lg font-semibold group-hover:text-indigo-300">{show.title}</h2>
            <p className="mb-4 text-sm text-slate-400">
              {show.venue.name} · {show.venue.city}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className={show.stats.available > 0 ? 'text-emerald-400' : 'text-red-400'}>
                {show.stats.available > 0 ? `${show.stats.available} seats left` : 'Sold out'}
              </span>
              <span className="text-slate-400">
                {money(Math.min(...(show.pricing.map((p) => p.priceCents) ?? [0])))} onwards
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}