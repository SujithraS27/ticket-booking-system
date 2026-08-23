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
  title: string;
  year: number;
  language: string;
  genre: string;
  rating: string;
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
    rating: 'PG-13',
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
    rating: 'A',
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
    rating: 'U',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BZTZiMWNhMzQtMDA1MS00MmMzLWFmMDYtNGJiMTg5YjA4OTE3XkEyXkFqcGc@._V1_QL75_UY562_CR35,0,380,562_.jpg',
    section: 'COMING_THIS_WEEK',
    releaseDate: 'Aug 28, 2026',
  },
];

/* ---- Confirmed September 2026 releases ---- */
export const SEPTEMBER_RELEASES: CatalogMovie[] = [
  {
    title: 'Sardar 2',
    year: 2026,
    language: 'Tamil · Telugu · Hindi',
    genre: 'Action · Spy Thriller',
    rating: 'U/A',
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
    rating: 'U/A',
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
    rating: 'A',
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
    rating: 'A',
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
    rating: 'U/A',
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
    rating: 'UA',
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
    rating: 'A',
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
    rating: 'U/A',
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
    rating: 'A',
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
    rating: 'U/A',
    posterUrl:
      'https://m.media-amazon.com/images/M/MV5BMjExZDc1MzUtNDc3Mi00NDcxLWFmYTAtYzI2MzhlMmE3YzBiXkEyXkFqcGc@._V1_SX300.jpg',
    section: 'RECENTLY_IN_THEATRES',
    releaseDate: 'Oct 10, 2024',
  },
];