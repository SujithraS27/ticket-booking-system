// Shared API types

export type Role = 'ADMIN' | 'ORG' | 'CUSTOMER';
export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'OFFERED';
export type SeatCategory = 'PREMIUM' | 'STANDARD';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Seat {
  id: string; // show-seat id
  seatId: string;
  label: string;
  row: number;
  col: number;
  category: SeatCategory;
  status: SeatStatus;
  priceCents: number;
  holdExpiresAt: string | null;
  heldByMe: boolean | null;
}

export interface ShowSummary {
  id: string;
  title: string;
  type: 'MOVIE' | 'CONCERT';
  description?: string | null;
  startsAt: string;
  venue: { id: string; name: string; city: string };
  organizer: { id: string; name: string };
  pricing: Array<{ category: SeatCategory; priceCents: number }>;
  stats: { available: number; held: number; booked: number; offered: number };
}

/** Full show detail returned by GET /api/shows/:id */
export interface ShowDetail {
  id: string;
  title: string;
  type: 'MOVIE' | 'CONCERT';
  description?: string | null;
  startsAt: string;
  venue: { id: string; name: string; city: string };
  organizer: { id: string; name: string; email: string };
  pricing: Array<{ category: SeatCategory; priceCents: number }>;
}

export interface Booking {
  id: string;
  reference: string;
  status: 'CONFIRMED' | 'CANCELLED';
  totalCents: number;
  createdAt: string;
  cancelledAt: string | null;
  qrDataUrl: string | null;
  show: {
    id: string;
    title: string;
    type: string;
    startsAt: string;
    venue: { name: string; city: string };
  };
  seats: Array<{ id: string; label: string; category: string; status: string }>;
}

export interface OfferInfo {
  token: string;
  status: string;
  expiresAt: string;
  customerId: string;
  show: {
    id: string;
    title: string;
    type: string;
    startsAt: string;
    venue: { name: string; city: string };
  };
  seat: { id: string; label: string; row: number; col: number; category: string; priceCents: number };
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  rows: number;
  seatsPerRow: number;
  premiumRows: number;
  _count?: { seats: number };
}

export function money(cents: number): string {
  return `₹${(cents / 100).toFixed(2)}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
