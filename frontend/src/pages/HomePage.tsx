import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { endpoints } from '../api';
import { posterUrl } from '../lib/images';
import { NOW_SHOWING, COMING_THIS_WEEK, SEPTEMBER_RELEASES, RECENTLY_IN_THEATRES, INDIAN_CINEMA_CLASSICS, type CatalogMovie } from '../lib/catalog';
import { formatDateTime, money, type ShowSummary } from '../types';

export function HomePage() {
  const [shows, setShows] = useState<ShowSummary[]>([]);
  const [type, setType] = useState('');
  const [city, setCity] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const p: Record<string, string> = {};
    if (type) p.type = type;
    if (city) p.city = city;
    if (search) p.search = search;
    endpoints.listShows(p).then((r) => setShows(r.shows)).catch((e) => setError(e.message));
  }, [type, city, search]);

  const all = useMemo(() => [...NOW_SHOWING, ...COMING_THIS_WEEK, ...SEPTEMBER_RELEASES, ...RECENTLY_IN_THEATRES, ...INDIAN_CINEMA_CLASSICS], []);
  const bookable = useMemo(() => shows.filter((s) =>
    (!search || s.title.toLowerCase().includes(search.toLowerCase())) &&
    (!type || s.type === type) && (!city || s.venue.city.toLowerCase().includes(city.toLowerCase()))
  ), [shows, search, type, city]);

  const catalog = useMemo(() => all.filter((m) =>
    !search || m.title.toLowerCase().includes(search.toLowerCase())
  ), [all, search]);

  const heroMovie = NOW_SHOWING[0];
  const heroShow = shows.find((s) => s.title === heroMovie?.title);
  const nowShowingCat = catalog.filter((m) => m.section === 'NOW_SHOWING');
  const comingWeek = catalog.filter((m) => m.section === 'COMING_THIS_WEEK');
  const septRel = catalog.filter((m) => m.section === 'SEPTEMBER_RELEASES');
  const trending = catalog.filter((m) => m.section === 'RECENTLY_IN_THEATRES');
  const classics = INDIAN_CINEMA_CLASSICS;

  const hindiCat = catalog.filter((m) => /hindi/i.test(m.language));
  const tamilCat = catalog.filter((m) => /tamil/i.test(m.language));
  const teluguCat = catalog.filter((m) => /telugu/i.test(m.language));
  const malayalamCat = catalog.filter((m) => /malayalam/i.test(m.language));
  const kannadaCat = catalog.filter((m) => /kannada/i.test(m.language));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 items-center justify-between px-4 max-w-7xl">
          <Link to="/" className="flex items-center gap-3">
            <span className="text-2xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">TICKETBOOK</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-slate-300 hover:text-white">Home</Link>
            <Link to="/" className="text-slate-300 hover:text-white">Movies</Link>
            <Link to="/" className="text-slate-300 hover:text-white">Concerts</Link>
            <Link to="/login" className="text-slate-300 hover:text-white">Login</Link>
            <Link to="/register" className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-500">Register</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="relative mb-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="What do you want to watch?"
            className="w-full rounded-xl border border-slate-700/70 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
          />
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
        </div>
        <div className="flex items-center gap-2">
          <FilterChip active={!type && !city} onClick={() => { setType(''); setCity(''); }}>All</FilterChip>
          <FilterChip active={type === 'MOVIE'} onClick={() => setType(type === 'MOVIE' ? '' : 'MOVIE')}>Movies</FilterChip>
          <FilterChip active={type === 'CONCERT'} onClick={() => setType(type === 'CONCERT' ? '' : 'CONCERT')}>Concerts</FilterChip>
          <input placeholder="City…" value={city} onChange={(e) => setCity(e.target.value)} className="w-32 rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-200 outline-none placeholder-slate-500 focus:border-indigo-500" />
        </div>
        {error && <p className="mt-2 text-red-400">{error}</p>}
      </div>

      {heroMovie && (
        <section className="relative overflow-hidden" style={{ height: '34rem' }}>
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${posterUrl(heroMovie.title)})` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-transparent" />
          <div className="relative flex h-full items-end pb-12">
            <div className="mx-auto w-full max-w-6xl px-4">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-600/20 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-red-300 ring-1 ring-red-500/30 backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> Now Showing
              </span>
              <h1 className="max-w-2xl text-4xl font-black leading-tight text-white sm:text-6xl">{heroMovie.title}</h1>
              <p className="mt-2 text-sm text-slate-300">{heroMovie.genre}</p>
              {heroShow && <p className="mt-1 text-sm text-slate-400">{heroShow.venue.name} · {heroShow.venue.city} · {formatDateTime(heroShow.startsAt)}</p>}
              {heroShow ? (
                <Link to={`/shows/${heroShow.id}`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-sm font-bold text-white shadow-2xl shadow-indigo-600/40 transition hover:-translate-y-0.5 hover:bg-indigo-500">
                  Book Tickets
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              ) : (
                <Link to={`/movies/${heroMovie.slug}`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-sm font-bold text-white shadow-2xl shadow-indigo-600/40 transition hover:-translate-y-0.5 hover:bg-indigo-500">
                  View Details
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {bookable.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 mt-12">
          <Rail title="Available to Book" subtitle="Choose seats and confirm instantly">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {bookable.map((show) => <ShowCard key={show.id} show={show} />)}
            </div>
          </Rail>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4">
        {nowShowingCat.length > 0 && (<Rail title="In Cinemas Now"><PosterGrid movies={nowShowingCat} /></Rail>)}
        {comingWeek.length > 0 && (<Rail title="Coming This Week"><PosterGrid movies={comingWeek} /></Rail>)}
        {septRel.length > 0 && (<Rail title="September Releases"><PosterGrid movies={septRel} /></Rail>)}
                {trending.length > 0 && (<Rail title="Trending Indian Cinema"><PosterGrid movies={trending} /></Rail>)}
        {classics.length > 0 && (<Rail title="Acclaimed Indian Cinema"><PosterGrid movies={classics} /></Rail>)}
        {hindiCat.length > 0 && (<Rail title="Hindi Cinema"><PosterGrid movies={hindiCat} /></Rail>)}
        {tamilCat.length > 0 && (<Rail title="Tamil Cinema"><PosterGrid movies={tamilCat} /></Rail>)}
        {teluguCat.length > 0 && (<Rail title="Telugu Cinema"><PosterGrid movies={teluguCat} /></Rail>)}
        {malayalamCat.length > 0 && (<Rail title="Malayalam Cinema"><PosterGrid movies={malayalamCat} /></Rail>)}
        {kannadaCat.length > 0 && (<Rail title="Kannada Cinema"><PosterGrid movies={kannadaCat} /></Rail>)}

        {bookable.length === 0 && catalog.length === 0 && !error && (
          <p className="mt-12 text-center text-slate-400">No results found.</p>
        )}
      </div>
    </main>
  );
}

function Rail({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mt-12 first:mt-0">
      <div className="mb-1 flex items-center gap-3">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-indigo-500/30 to-transparent" />
      </div>
      {subtitle && <p className="-mt-1 mb-4 text-xs text-slate-500">{subtitle}</p>}
      {children}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' : 'border border-slate-700/70 bg-slate-900/80 text-slate-400 hover:text-white'}`}>
      {children}
    </button>
  );
}

function ShowCard({ show }: { show: ShowSummary }) {
  const isMovie = show.type === 'MOVIE';
  const poster = posterUrl(show.title);
  const priceFrom = show.pricing && show.pricing.length > 0 ? Math.min(...show.pricing.map((p) => p.priceCents)) : 0;

  return (
    <Link to={`/shows/${show.id}`} className="group block">
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 ring-1 ring-slate-800/50 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-indigo-500/30 group-hover:shadow-2xl group-hover:shadow-indigo-900/20">
        <div className="relative aspect-[2/3] overflow-hidden">
          <img src={poster} alt={show.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" onError={(e) => { (e.target as HTMLImageElement).src = '/assets/placeholder.svg'; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${isMovie ? 'bg-indigo-600/80 text-white' : 'bg-amber-600/80 text-white'}`}>{show.type}</span>
        </div>
        <div className="p-3">
          <h3 className="font-bold text-white group-hover:text-indigo-300">{show.title}</h3>
          <p className="mt-1 text-xs text-slate-400">{show.venue.name} · {show.venue.city}</p>
          {priceFrom > 0 && <p className="mt-1 text-xs text-slate-300">{money(priceFrom)} onwards</p>}
          <div className="mt-2 flex items-center justify-between">
            <span className="rounded-full bg-indigo-600/20 px-3 py-1 text-xs font-bold text-indigo-200">View Seats</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PosterGrid({ movies }: { movies: CatalogMovie[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {movies.map((movie) => (
        <Link key={movie.title} to={`/movies/${movie.slug}`} className="block group">
          <div className="relative aspect-[2/3] overflow-hidden rounded-lg shadow-lg ring-1 ring-slate-800/50 transition-all duration-300 group-hover:-translate-y-1 group-hover:ring-indigo-500/30">
            <img src={movie.posterUrl} alt={movie.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" onError={(e) => { (e.target as HTMLImageElement).src = '/assets/placeholder.svg'; }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <span className="rounded-full bg-indigo-600/80 px-1.5 py-0.5 text-xs font-bold uppercase text-white">
                {movie.section === 'NOW_SHOWING' ? 'Now Showing' : movie.section === 'COMING_THIS_WEEK' ? 'Coming This Week' : movie.section === 'SEPTEMBER_RELEASES' ? 'September' : 'Recently Released'}
              </span>
              <h3 className="mt-1 text-xs font-bold text-white">{movie.title}</h3>
              <p className="truncate text-[10px] text-slate-400">{movie.genre}</p>
              <p className="text-[10px] text-slate-300">{movie.year} · {movie.language}</p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-indigo-950/70 opacity-0 transition duration-300 group-hover:opacity-100">
              <span className="rounded-full bg-indigo-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white">View Details</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
