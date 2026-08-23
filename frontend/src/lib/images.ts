/**
 * Maps event/show titles to poster images.
 * Movies use real theatrical posters served from the IMDb CDN (m.media-amazon.com).
 * Concerts use self-contained SVG artwork in /public/assets.
 */

const ASSET_BASE = '/assets';

/** Real theatrical poster URLs from IMDb CDN — publicly accessible, no auth needed. */
const MOVIE_POSTERS: Array<{ match: RegExp; url: string }> = [
  {
    match: /dune.*part.*two|dune\s*2/i,
    url: 'https://m.media-amazon.com/images/M/MV5BNTc0YmQxMjEtODI5MC00NjFiLTlkMWUtOGQ5NjFmYWUyZGJhXkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg',
  },
  {
    match: /oppenheimer/i,
    url: 'https://m.media-amazon.com/images/M/MV5BN2JkMDc5MGQtZjg3YS00NmFiLWIyZmwtZTJmNTM5MjVmYTQ4XkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg',
  },
  {
    match: /everything.*everywhere/i,
    url: 'https://m.media-amazon.com/images/M/MV5BOWNmMzAzZmQtNDQ1NC00Nzk5LTkyMmUtNGI2N2NkOWM4MzEyXkEyXkFqcGc@._V1_QL75_UY562_CR4,0,380,562_.jpg',
  },
  {
    match: /spider.man.*brand.*new.*day/i,
        url: 'https://m.media-amazon.com/images/M/MV5BOWNjYWM3NWItOGE0ZS00MWRjLThiZWEtYjc4ZmNmMmU5ZTVmXkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg',
  },
  {
    match: /toxic/i,
    url: 'https://m.media-amazon.com/images/M/MV5BZDk0NDZhNTctNTQ4Ny00YmMzLWIxZDctNWViYmVhYTQ2ZDFhXkEyXkFqcGc@._V1_QL75_UY562_CR15,0,380,562_.jpg',
  },
  {
    match: /khosla.*ghosla/i,
    url: 'https://m.media-amazon.com/images/M/MV5BZTZiMWNhMzQtMDA1MS00MmMzLWFmMDYtNGJiMTg5YjA4OTE3XkEyXkFqcGc@._V1_QL75_UY562_CR35,0,380,562_.jpg',
  },
  {
    match: /sardar.*2/i,
    url: 'https://m.media-amazon.com/images/M/MV5BNTMzNjZkODEtNjRiMS0wMjFiLWE0YWYtOGQ5ZGVlODQ1NDVmXkEyXkFqcGc@._V1_SX300.jpg',
  },
  {
    match: /vvan|force.*forest/i,
    url: 'https://m.media-amazon.com/images/M/MV5BNWNjMzFkYzctOGY4ZS00ZmYyLTgzNDktNmYzMjY3MmRjZDE1XkEyXkFqcGc@._V1_SX300.jpg',
  },
  {
    match: /coolie/i,
    url: 'https://m.media-amazon.com/images/M/MV5BOTYwYzYxMWYtZmI4MS00ZGRhLWEyMGEtZTdiODc3YjAyNDE0XkEyXkFqcGc@._V1_SX300.jpg',
  },
  {
    match: /war.*2/i,
    url: 'https://m.media-amazon.com/images/M/MV5BY2U0MGFkNzctOGI5OC00MzhhLWExYTctZjE5YjY3MzcwYjMzXkEyXkFqcGc@._V1_SX300.jpg',
  },
];

const CONCERT_POSTERS: Array<{ match: RegExp; file: string }> = [
  { match: /sunburn/i, file: 'sunburn.svg' },
  { match: /jazz/i, file: 'jazz.svg' },
];

export function posterFor(title: string): string {
  const lower = title.toLowerCase();
  for (const m of MOVIE_POSTERS) if (m.match.test(lower)) return m.url;
  for (const c of CONCERT_POSTERS) if (c.match.test(lower)) return `${ASSET_BASE}/${c.file}`;
  return `${ASSET_BASE}/placeholder.svg`;
}

export function posterUrl(title: string): string {
  return posterFor(title);
}
