import type { SeatCategory } from './types';

const TOKEN_KEY = 'tbs.token';

// In development the Vite dev-server proxies /api and /socket.io to the
// backend, so VITE_API_URL is empty and we use a relative base. In production
// VITE_API_URL points at the deployed backend (e.g. Render).
const BASE_URL = import.meta.env.VITE_API_URL || '';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

// ---- API calls -------------------------------------------------------

export interface SeatMapResponse {
  showId: string;
  seats: import('./types').Seat[];
}

export const endpoints = {
  register: (body: { name: string; email: string; password: string; role: SeatCategory | 'ADMIN' | 'ORG' | 'CUSTOMER' }) =>
    api.post<{ token: string; user: import('./types').User }>('/auth/register', body),
  login: (body: { email: string; password: string }) =>
    api.post<{ token: string; user: import('./types').User }>('/auth/login', body),
  me: () => api.get<{ user: import('./types').User }>('/auth/me'),

  listShows: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get<{ shows: import('./types').ShowSummary[] }>(`/shows${qs ? `?${qs}` : ''}`);
  },
  showDetail: (showId: string) =>
    api.get<{ show: import('./types').ShowDetail }>(`/shows/${showId}`),
  seatMap: (showId: string) => api.get<SeatMapResponse>(`/shows/${showId}/seats/map`),
  holdSeats: (showId: string, seatIds: string[]) =>
    api.post<{ showId: string; expiresAt: string; seats: unknown[] }>(`/shows/${showId}/seats/holds`, { seatIds }),
  releaseHolds: (showId: string, seatIds: string[]) =>
    api.post<{ released: number }>(`/shows/${showId}/seats/holds/release`, { seatIds }),
  joinWaitlist: (showId: string, category: SeatCategory) =>
    api.post(`/shows/${showId}/waitlist`, { category }),
  leaveWaitlist: (showId: string, category: SeatCategory) =>
    api.del(`/shows/${showId}/waitlist`, { category }),

  book: (showId: string, seatIds: string[]) =>
    api.post<{
      booking: { id: string; reference: string; totalCents: number; qrDataUrl: string; status: string };
      seats: Array<{ label: string; category: string }>;
    }>('/bookings', { showId, seatIds }),
  myBookings: () => api.get<{ bookings: import('./types').Booking[] }>('/bookings/my'),
  cancelBooking: (id: string) =>
    api.post<{ bookingId: string; offersCreated: Array<{ token: string }> }>(`/bookings/${id}/cancel`),

  offerInfo: (token: string) => api.get<{ offer: import('./types').OfferInfo }>(`/offers/${token}`),
  acceptOffer: (token: string) =>
    api.post<{ reference: string; totalCents: number; qrDataUrl: string; seats: Array<{ label: string }> }>(
      `/offers/${token}/accept`,
    ),
  declineOffer: (token: string) => api.post(`/offers/${token}/decline`),

  venues: () => api.get<{ venues: import('./types').Venue[] }>('/venues'),
  createVenue: (body: { name: string; city: string; rows: number; seatsPerRow: number; premiumRows: number }) =>
    api.post<{ venue: import('./types').Venue }>('/venues', body),

  organiserStats: () =>
    api.get<{
      rows: Array<{
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
      }>;
      totals: { shows: number; revenueCents: number; ticketsSold: number; bookingsCount: number };
    }>('/organiser/stats'),
};


