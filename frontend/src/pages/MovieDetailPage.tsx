import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { endpoints } from '../api';
import { ALL_CATALOG_MOVIES, findCatalogMovie, formatRuntime } from '../lib/catalog';
import { money, formatDateTime, type ShowSummary } from '../types';

const UNAVAILABLE = 'Information unavailable';

type Tone = 'live' | 'soon' | 'past';

/** Status is derived from REAL data: backend show first, then release date. */
function resolveStatus(m: { releaseDate: string }, bookable: boolean): { label: string; tone: Tone; caption: string } {
  if (bookable) {
    const rd = new Date(m.releaseDate).getTime();
    const now = Date.now();
    if (rd <= now) {
      // Released movie with current/upcoming shows → Now Showing
      return { label: 'Now Showing', tone: 'live', caption: '' };
    }
    // Unreleased movie with future pre-booking shows → Pre-Booking Open
    return { label: 'Pre-Booking Open', tone: 'soon', caption: 'Pre-booking is open for upcoming shows.' };
  }
  const rd = new Date(m.releaseDate).getTime();
  const now = Date.now();
  if (rd > now) {
    const days = (rd - now) / 86_400_000;
    const label = days <= 14 ? 'Coming This Week' : 'Coming Soon';
    return { label, tone: 'soon', caption: 'Booking opens closer to release.' };
  }
  const ageDays = (now - rd) / 86_400_000;
  if (ageDays <= 75) return { label: 'Recently Released', tone: 'past', caption: 'This theatrical run has ended on TICKETBOOK.' };
  return { label: 'Released', tone: 'past', caption: 'Tickets for this title are closed on TICKETBOOK.' };
}

const TONE_PILL: Record<Tone, string> = {
  live: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40',
  soon: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
  past: 'bg-slate-500/15 text-slate-300 ring-slate-500/40',
};

export function MovieDetailPage() {
  const { slug = '' } = useParams();
  const movie = findCatalogMovie(slug);

  const [shows, setShows] = useState<ShowSummary[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    endpoints
      .listShows()
      .then((r) => setShows(r.shows))
      .catch(() => setFailed(true));
  }, []);

  if (!movie) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-24 text-center text-slate-300">
        <p className="text-3xl">🎬</p>
        <h1 className="mt-4 text-2xl font-bold text-white">Movie not found</h1>
        <p className="mt-2 text-sm text-slate-400">This entry is not part of the TICKETBOOK catalogue.</p>
        <Link to="/" className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-500">
          ← Back to home
        </Link>
      </main>
    );
  }

  // Bookable ONLY when the backend actually has a matching show.
  const show = shows.find((s) => s.title.toLowerCase() === movie.title.toLowerCase());
  const bookable = !!show && !failed;
  const priceFrom = show && show.pricing.length > 0 ? Math.min(...show.pricing.map((p) => p.priceCents)) : null;
  const status = resolveStatus(movie, bookable);
  const runtime = formatRuntime(movie.runtimeMinutes ?? (movie.runtime ? undefined : undefined)) ?? movie.runtime;
  const backdrop = movie.backdropUrl ?? movie.posterUrl;
  const related = relatedMovies(movie);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Full-width cinematic backdrop ─────────────────────────────── */}
      <div className="relative">
        <img
          src={backdrop}
          alt=""
          aria-hidden
          className="h-[22rem] w-full scale-105 object-cover sm:h-[30rem]"
          onError={(e) => { (e.target as HTMLImageElement).src = '/assets/placeholder.svg'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/25 to-transparent" />
      </div>

      <section className="mx-auto max-w-6xl px-4">
        {/* ── Poster + headline block ─────────────────────────────────── */}
        <div className="-mt-24 flex flex-col gap-6 pb-2 sm:-mt-36 sm:flex-row sm:items-end">
          <div className="relative w-44 shrink-0 overflow-hidden rounded-2xl shadow-2xl shadow-black/70 ring-1 ring-white/10 sm:w-56">
            <img
              src={movie.posterUrl}
              alt={`${movie.title} poster`}
              className="aspect-[2/3] h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = '/assets/placeholder.svg'; }}
            />
            {!bookable && (
              <div className={`absolute inset-x-0 bottom-0 px-2 py-1.5 text-center text-[11px] font-black uppercase tracking-widest ${status.tone === 'soon' ? 'bg-amber-500/90 text-slate-950' : 'bg-slate-900/90 text-slate-200'}`}>
                {status.tone === 'soon' ? 'Coming Soon' : 'Not Booking'}
              </div>
            )}
          </div>

          <div className="flex-1">
            <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-[0.18em] ring-1 ${TONE_PILL[status.tone]}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.tone === 'live' ? 'animate-pulse bg-emerald-400' : status.tone === 'soon' ? 'bg-amber-400' : 'bg-slate-400'}`} />
              {status.label}
            </span>

            <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white drop-shadow-lg sm:text-5xl">
              {movie.title}
            </h1>

            {/* Single metadata row */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-300">
              {movie.certification && (
                <span className="rounded-md border border-slate-500 px-2 py-0.5 text-xs font-black text-white">{movie.certification}</span>
              )}
              <span>{movie.genre}</span>
              <Dot />
              <span>{movie.language}</span>
              <Dot />
              <span>{movie.year}</span>
              {runtime && (
                <>
                  <Dot />
                  <span>{runtime}</span>
                </>
              )}
            </div>

            {/* Real booking panel — only when the backend has this show */}
            {bookable && show ? (
              <div className="mt-5 max-w-md rounded-2xl border border-emerald-500/25 bg-slate-900/70 p-4 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">In cinemas near you</p>
                <p className="mt-1.5 text-sm font-bold text-white">{show.venue.name} · {show.venue.city}</p>
                <p className="text-sm text-slate-300">{formatDateTime(show.startsAt)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <span className="rounded-md bg-emerald-500/15 px-2 py-1 font-bold text-emerald-300">
                    {money(priceFrom ?? 0)} onwards
                  </span>
                  {show.stats.available > 0 && (
                    <span className="text-slate-400">{show.stats.available} seats available</span>
                  )}
                </div>
                <Link
                  to={`/shows/${show.id}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-7 py-3 text-sm font-bold text-white shadow-xl shadow-indigo-600/40 transition hover:-translate-y-0.5 hover:bg-indigo-500"
                >
                  Book Tickets
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            ) : (
              <div className="mt-5">
                <span className={`inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-bold ${status.tone === 'soon' ? 'border-amber-500/50 bg-amber-500/10 text-amber-200' : 'border-slate-600/60 bg-slate-800/60 text-slate-200'}`}>
                  {status.tone === 'soon' ? 'Coming Soon' : 'Not currently available for booking'}
                </span>
                {status.caption && <p className="mt-2 text-xs text-slate-500">{status.caption}</p>}
                <Link to="/" className="ml-3 inline-block rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white">
                  ← Browse all
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Synopsis + details ───────────────────────────────────────── */}
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xs font-black uppercase tracking-[0.22em] text-indigo-300">Synopsis</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{movie.overview ?? UNAVAILABLE}</p>

            {(movie.director || movie.cast) && (
              <>
                <h3 className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-indigo-300">Cast &amp; Crew</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  {movie.director && (
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <dt className="w-20 shrink-0 text-slate-500">Director</dt>
                      <dd className="font-semibold text-slate-100">{movie.director}</dd>
                    </div>
                  )}
                  {movie.cast && movie.cast.length > 0 && (
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <dt className="w-20 shrink-0 text-slate-500">Starring</dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {movie.cast.map((person) => (
                          <span key={person} className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-slate-700">
                            {person}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </>
            )}
          </div>

          {/* Details side panel */}
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xs font-black uppercase tracking-[0.22em] text-indigo-300">Details</h2>
            <DetailRow label="Status" value={status.label} />
            <DetailRow label="Certification" value={movie.certification ?? 'Certification unavailable'} />
            <DetailRow label="Release date" value={movie.releaseDate} />
            <DetailRow label="Languages" value={movie.language} />
            <DetailRow label="Runtime" value={runtime ?? UNAVAILABLE} muted={!runtime} />
            <DetailRow label="Director" value={movie.director ?? UNAVAILABLE} muted={!movie.director} />
          </aside>
        </div>

        {/* ── Related movies ──────────────────────────────────────────── */}
        {related.length > 0 && (
          <div className="mt-12 pb-14">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-black text-white">More like this</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-indigo-500/40 to-transparent" />
            </div>
            <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
              {related.map((rel) => (
                <Link key={rel.slug} to={`/movies/${rel.slug}`} className="group w-36 shrink-0 snap-start sm:w-40">
                  <div className="relative overflow-hidden rounded-xl shadow-lg ring-1 ring-slate-800 transition-all duration-300 group-hover:-translate-y-1 group-hover:ring-indigo-500/40">
                    <img
                      src={rel.posterUrl}
                      alt={rel.title}
                      loading="lazy"
                      className="aspect-[2/3] h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/assets/placeholder.svg'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 transition group-hover:opacity-100" />
                    <div className="absolute inset-x-0 bottom-0 p-2">
                      <p className="truncate text-xs font-bold text-white">{rel.title}</p>
                      <p className="truncate text-[10px] text-slate-400">{rel.language}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Dot() {
  return <span aria-hidden className="text-slate-600">·</span>;
}

/** Scores catalog movies by shared language/genre with the current one; excludes itself. */
function relatedMovies(movie: NonNullable<ReturnType<typeof findCatalogMovie>>) {
  const langs = movie.language.toLowerCase().split('·').map((s) => s.trim());
  const genres = movie.genre.toLowerCase().split('·').map((s) => s.trim());
  return ALL_CATALOG_MOVIES
    .filter((m) => m.slug !== movie.slug)
    .map((m) => {
      let score = 0;
      const ml = m.language.toLowerCase();
      const mg = m.genre.toLowerCase();
      for (const l of langs) if (ml.includes(l)) score += 2;
      for (const g of genres) if (mg.includes(g)) score += 1;
      return { m, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((r) => r.m);
}

function DetailRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="border-b border-slate-800/80 py-2.5 last:border-none">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${muted ? 'italic text-slate-500' : 'text-slate-100'}`}>{value}</p>
    </div>
  );
}