/**
 * TICKETBOOK — Indian Cinema Discovery Catalog
 * Real theatrical posters from IMDb CDN (m.media-amazon.com).
 * All titles verified via OMDb API.
 */

export type CatalogSection =
  | 'NOW_SHOWING'
  | 'COMING_THIS_WEEK'
  | 'COMING_SOON'
  | 'SEPTEMBER_RELEASES'
  | 'RECENTLY_IN_THEATRES';

export interface CatalogMovie {
  slug: string;
  title: string;
  year: number;
  language: string;
  genre: string;
  certification: string | null;
  /** Omitted when not verified. */
  runtime?: string;
  /** Verified director, when known. */
  director?: string;
  /** Verified principal cast, when known. */
  cast?: string[];
  /** Verified theatrical runtime in minutes. */
  runtimeMinutes?: number;
  overview?: string;
  backdropUrl?: string;
  posterUrl: string;
  section: CatalogSection;
  releaseDate: string;
}

/* ---- Verified currently playing (as of Aug 23, 2026) ---- */
export const NOW_SHOWING: CatalogMovie[] = [
  {
    title: 'Spider-Man: Brand New Day',
    year: 2026,
    language: 'English · Hindi · Tamil · Telugu',
    genre: 'Action · Adventure · Sci-Fi',
        slug: 'spider-man-brand-new-day',
    director: 'Destin Daniel Cretton',
    cast: ['Tom Holland'],
    certification: null,
    overview: 'A brand-new chapter in the Spider-Man franchise, bringing a high-octane superhero adventure to theatres across India.',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BOWNjYWM3NWItOGE0ZS00MWRjLThiZWEtYjc4ZmNmMmU5ZTVmXkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg',
    section: 'NOW_SHOWING',
    releaseDate: 'Jul 31, 2026',
  },
];

/* ---- Releasing Aug 24–31, 2026 ---- */
export const COMING_THIS_WEEK: CatalogMovie[] = [
  {
    title: 'Toxic',
    year: 2026,
    language: 'Kannada · Hindi · Telugu · Tamil',
    genre: 'Action · Crime · Drama',
        slug: 'toxic',
    director: 'Geetu Mohandas',
    cast: ['Yash', 'Kiara Advani'],
    certification: 'A',
    overview: 'A stylised pan-Indian action drama built around a crime family and its high-octane power play — one of the year’s most anticipated releases.',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BZDk0NDZhNTctNTQ4Ny00YmMzLWIxZDctNWViYmVhYTQ2ZDFhXkEyXkFqcGc@._V1_QL75_UY562_CR15,0,380,562_.jpg',
    section: 'COMING_THIS_WEEK',
    releaseDate: 'Aug 26, 2026',
  },
  {
    title: 'Khosla Ka Ghosla 2',
    year: 2026,
    language: 'Hindi',
    genre: 'Comedy · Drama',
        slug: 'khosla-ka-ghosla-2',
    certification: 'U',
    overview: 'The warm, laugh-filled follow-up to the cult comedy classic — the Khosla family returns for a new round of misadventures.',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BZTZiMWNhMzQtMDA1MS00MmMzLWFmMDYtNGJiMTg5YjA4OTE3XkEyXkFqcGc@._V1_QL75_UY562_CR35,0,380,562_.jpg',
    section: 'COMING_THIS_WEEK',
    releaseDate: 'Aug 28, 2026',
  },
];

/* ---- Unconfirmed upcoming releases (none verified at the moment) ---- */
export const COMING_SOON: CatalogMovie[] = [];

/* ---- Confirmed September 2026 releases ---- */
export const SEPTEMBER_RELEASES: CatalogMovie[] = [
  {
    title: 'Sardar 2',
    year: 2026,
    language: 'Tamil · Telugu · Hindi',
    genre: 'Action · Spy Thriller',
        slug: 'sardar-2',
    director: 'P. S. Mithran',
    cast: ['Karthi'],
    certification: 'U/A',
    overview: 'The Tamil blockbuster spy saga returns, with the original lead back on the mission and a much bigger worldwide canvas.',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BNTMzNjZkODEtNjRiMS00MjFiLWE0YWYtOGQ5ZGVlODQ1NDVmXkEyXkFqcGc@._V1_SX300.jpg',
    section: 'SEPTEMBER_RELEASES',
    releaseDate: 'Sep 10, 2026',
  },
  {
    title: 'Vvan – Force of the Forest',
    year: 2026,
    language: 'Hindi',
    genre: 'Thriller',
        slug: 'vvan-force-of-the-forest',
    cast: ['Sidharth Malhotra'],
    certification: 'U/A',
    overview: 'A forest-set survival thriller that pits a lone man against the wild — a Hindi-language adventure.',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BNWNjMzFkYzctOGY4ZS00ZmYyLTgzNDktNmYzMjY3MmRjZDE1XkEyXkFqcGc@._V1_SX300.jpg',
    section: 'SEPTEMBER_RELEASES',
    releaseDate: 'Sep 25, 2026',
  },
];

/* ---- Notable recent Indian theatrical releases ---- */
export const RECENTLY_IN_THEATRES: CatalogMovie[] = [
  {
    title: 'Coolie',
    year: 2025,
    language: 'Tamil · Telugu · Hindi · Kannada',
    genre: 'Action · Crime · Thriller',
        slug: 'coolie',
    director: 'Lokesh Kanagaraj',
    cast: ['Rajinikanth', 'Nagarjuna Akkineni', 'Upendra', 'Shruti Haasan'],
    runtimeMinutes: 168,
    certification: 'A',
    overview: 'A high-energy Tamil action picture built around a commanding central performance.',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BOTYwYzYxMWYtZmI4MS00ZGRhLWEyMGEtZTdiODc3YjAyNDE0XkEyXkFqcGc@._V1_SX300.jpg',
    section: 'RECENTLY_IN_THEATRES',
    releaseDate: 'Aug 14, 2025',
  },
  {
    title: 'War 2',
    year: 2025,
    language: 'Hindi · Telugu · Tamil',
    genre: 'Action · Thriller',
        slug: 'war-2',
    director: 'Ayan Mukerji',
    cast: ['Hrithik Roshan', 'N. T. Rama Rao Jr.', 'Kiara Advani'],
    runtimeMinutes: 173,
    certification: 'A',
    overview: 'The action-spy franchise returns with a new high-stakes mission.',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BY2U0MGFkNzctOGI5OC00MzhhLWExYTctZjE5YjY3MzcwYjMzXkEyXkFqcGc@._V1_SX300.jpg',
    section: 'RECENTLY_IN_THEATRES',
    releaseDate: 'Aug 14, 2025',
  },
];

/* ---- Acclaimed Indian films from 2024 (extended runs / re-releases) ---- */
export const INDIAN_CINEMA_CLASSICS: CatalogMovie[] = [
  {
    title: 'Lokah Chapter One: Chandra',
    year: 2025,
    language: 'Malayalam',
    genre: 'Action · Fantasy',
        slug: 'lokah-chapter-one-chandra',
    director: 'Dominic Arun',
    cast: ['Kalyani Priyadarshan', 'Naslen'],
    certification: 'U/A',
    overview: 'A Malayalam action-fantasy that opens a sweeping new cinematic universe.',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BNWFkMGFmNTQtOTUwYS00NDFkLWFkNDAtZjA4ODliYTc2MmFmXkEyXkFqcGc@._V1_SX300.jpg',
    section: 'RECENTLY_IN_THEATRES',
    releaseDate: 'Aug 28, 2025',
  },
  {
    title: 'Kantara: A Legend – Chapter 1',
    year: 2025,
    language: 'Kannada · Hindi · English',
    genre: 'Action · Thriller',
        slug: 'kantara-a-legend-chapter-1',
    director: 'Rishab Shetty',
    cast: ['Rishab Shetty', 'Rukmini Vasanth'],
    runtimeMinutes: 148,
    certification: 'U/A',
    overview: 'The folk-epic universe expands in this prequel set in a coastal fiefdom.',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BNDU2ZTYxYTMtMjhlZC00ZjEwLThhNDUtMzdlNWM4ZDcyYTM1XkEyXkFqcGc@._V1_SX300.jpg',
    section: 'RECENTLY_IN_THEATRES',
    releaseDate: 'Oct 3, 2025',
  },
  {
    title: 'Maharaja',
    year: 2024,
    language: 'Tamil',
    genre: 'Action · Crime · Thriller',
        slug: 'maharaja',
    director: 'Nithilan Swaminathan',
    cast: ['Vijay Sethupathi', 'Anurag Kashyap', 'Mamta Mohandas'],
    runtimeMinutes: 141,
    certification: 'A',
    overview: 'A gripping Tamil crime-drama driven by a towering central performance.',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BOTFlMTIxOGItZTk0Zi00MTk2LWJiM2UtMzlhZWYzNjQ4N2Y3XkEyXkFqcGc@._V1_SX300.jpg',
    section: 'RECENTLY_IN_THEATRES',
    releaseDate: 'Jun 14, 2024',
  },
  {
    title: 'Amaran',
    year: 2024,
    language: 'Tamil',
    genre: 'Action · Biography · Drama',
        slug: 'amaran',
    director: 'Rajkumar Periasamy',
    cast: ['Sivakarthikeyan', 'Sai Pallavi', 'Bhuvan Arora'],
    runtimeMinutes: 166,
    certification: 'U/A',
    overview: 'A patriotic biographical action-drama honouring a soldier’s story.',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BNTAzMGQ2MGItMjk5OC00YWIwLThmMjUtYmNjMTIxNzVlZWQ4XkEyXkFqcGc@._V1_SX300.jpg',
    section: 'RECENTLY_IN_THEATRES',
    releaseDate: 'Oct 31, 2024',
  },
  {
    title: 'Devara Part 1',
    year: 2024,
    language: 'Telugu',
    genre: 'Action · Adventure · Drama',
        slug: 'devara-part-1',
    director: 'Koratala Siva',
    cast: ['N. T. Rama Rao Jr.', 'Saif Ali Khan', 'Janhvi Kapoor'],
    runtimeMinutes: 178,
    certification: 'A',
    overview: 'A large-scale Telugu period action adventure built around honour and revenge.',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BYmI5NTljYWItMDhjMC00NDQwLWFhMjQtNWNjNDYzYzkwNGQ0XkEyXkFqcGc@._V1_QL75_UY562_CR35,0,380,562_.jpg',
    section: 'RECENTLY_IN_THEATRES',
    releaseDate: 'Sep 27, 2024',
  },
  {
    title: 'Vettaiyan',
    year: 2024,
    language: 'Tamil',
    genre: 'Action · Crime · Drama',
        slug: 'vettaiyan',
    director: 'T. J. Gnanavel',
    cast: ['Rajinikanth', 'Amitabh Bachchan', 'Fahadh Faasil', 'Rana Daggubati'],
    runtimeMinutes: 160,
    certification: 'U/A',
    overview: 'A Tamil action drama about a maverick officer taking on a corrupt system.',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BMjExZDc1MzUtNDc3Mi00NDcxLWFmYTAtYzI2MzhlMmE3YzBiXkEyXkFqcGc@._V1_SX300.jpg',
    section: 'RECENTLY_IN_THEATRES',
    releaseDate: 'Oct 10, 2024',
  },
];
export function movieStatus(m: CatalogMovie): string {
  switch (m.section) {
    case 'NOW_SHOWING':
      return 'Now Showing';
    case 'COMING_THIS_WEEK':
      return 'Coming This Week';
    case 'COMING_SOON':
    case 'SEPTEMBER_RELEASES':
      return 'Coming Soon';
    case 'RECENTLY_IN_THEATRES':
      return 'Recently in Theatres';
    default:
      return m.section;
  }
}

/** Formats a runtime in minutes as e.g. "2h 21m"; undefined when unverified. */
export function formatRuntime(minutes?: number): string | undefined {
  if (!minutes || minutes <= 0) return undefined;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Every discovery entry, for one slug lookup table. */
export const ALL_CATALOG_MOVIES: CatalogMovie[] = [
  ...NOW_SHOWING,
  ...COMING_THIS_WEEK,
  ...COMING_SOON,
  ...SEPTEMBER_RELEASES,
  ...RECENTLY_IN_THEATRES,
  ...INDIAN_CINEMA_CLASSICS,
];

export function findCatalogMovie(slug: string): CatalogMovie | undefined {
  return ALL_CATALOG_MOVIES.find((m) => m.slug === slug);
}