import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { endpoints } from '../api';
import { findCatalogMovie, movieStatus } from '../lib/catalog';
import { money, type ShowSummary } from '../types';

/**
 * Discovery movie detail page (/movies/:slug).
 *
 * Shows real catalog metadata (poster, genre, language, release date,
 * certification, overview). A "Book Tickets" action is rendered ONLY when
 * the backend actually contains a matching show — otherwise the page clearly
 * says the movie is Coming Soon / not currently available for booking.
 */
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
        <p className="mt-2 text-sm text-slate-400">
          This entry is not part of the TICKETBOOK catalogue.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
        >
          ← Back to home
        </Link>
      </main>
    );
  }

  // A real bookable backend show matches this movie's title.
  const show = shows.find((s) => s.title.toLowerCase() === movie.title.toLowerCase());
  const priceFrom =
    show && show.pricing.length > 0 ? Math.min(...show.pricing.map((p) => p.priceCents)) : null;
  const bookable = !!show && !failed;
  const status = movieStatus(movie);
  const coming = movie.section === 'COMING_THIS_WEEK' || movie.section === 'COMING_SOON' || movie.section === 'SEPTEMBER_RELEASES';
  const backdrop = movie.backdropUrl ?? movie.posterUrl;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Cinematic backdrop */}
      <section className="relative overflow-hidden" style={{ height: '30rem' }}>
        <img
          src={backdrop}
          alt={movie.title}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/assets/placeholder.svg';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/20" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent" />
      </section>

      <div className="mx-auto -mt-40 max-w-6xl px-4">
<div className="relative flex flex-col gap-6 sm:flex-row sm:items-end">
          {/* Poster with Coming Soon ribbon when not bookable */}
          <div className="relative h-64 w-44 shrink-0 overflow-hidden rounded-2xl border border-slate-700 shadow-2xl shadow-black/60 sm:h-72 sm:w-52">
            <img
              src={movie.posterUrl}
              alt={movie.title}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/placeholder.svg';
              }}
            />
            {!bookable && (
              <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Coming Soon
              </div>
            )}
          </div>

          {/* Title + metadata + CTA */}
          <div className="pb-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-600/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-indigo-300 ring-1 ring-indigo-500/40">
              {bookable ? 'Now Showing · Bookable' : status}
            </span>
            <h1 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">
              {movie.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
              {movie.certification && (
                <span className="rounded border border-slate-600 px-1.5 py-0.5 text-xs font-bold text-slate-200">
                  {movie.certification}
                </span>
              )}
              <span>{movie.genre}</span>
              <span className="text-slate-500">·</span>
              <span>{movie.language}</span>
              <span className="text-slate-500">·</span>
              <span>{movie.year}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Release: <span className="text-slate-200">{movie.releaseDate}</span>
              {movie.runtime ? (
                <>
                  {' '}· Runtime: <span className="text-slate-200">{movie.runtime}</span>
                </>
              ) : null}
            </p>
            {bookable && show && (
              <p className="mt-2 text-sm text-slate-300">
                {show.venue.name} · {show.venue.city}
                {priceFrom !== null && priceFrom > 0 && (
                  <span className="ml-2 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
                    {money(priceFrom)} onwards
                  </span>
                )}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              {bookable && show ? (
                <Link
                  to={`/shows/${show.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-7 py-3 text-sm font-bold text-white shadow-xl shadow-indigo-600/30 transition hover:-translate-y-0.5 hover:bg-indigo-500"
                >
                  Book Tickets
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-xl border border-amber-600/50 bg-amber-600/10 px-6 py-3 text-sm font-bold text-amber-300">
                  {coming ? 'Coming Soon' : 'Not currently available for booking'}
                </span>
              )}
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                ← Browse all
              </Link>
            </div>
          </div>
        </div>
{/* Synopsis */}
        {movie.overview && (
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">Synopsis</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">{movie.overview}</p>
          </div>
        )}

        {/* Info tiles */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:max-w-lg">
          <InfoTile label="Status" value={status} />
          <InfoTile
            label="Certification"
            value={movie.certification ? movie.certification : 'Certification unavailable'}
          />
          <InfoTile label="Release date" value={movie.releaseDate} />
          <InfoTile label="Language" value={movie.language} />
        </div>
      </div>
    </main>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}