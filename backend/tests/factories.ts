import request from 'supertest';
import { app } from './app';

/** Creates a venue via the API as the provided (admin) token. */
export async function createVenueT(
  token: string,
  opts: { rows: number; seatsPerRow: number; premiumRows?: number; name?: string; city?: string },
): Promise<{ id: string; rows: number; seatsPerRow: number; premiumRows: number }> {
  const res = await request(app())
    .post('/api/venues')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: opts.name ?? 'Test Arena',
      city: 'Test City',
      rows: opts.rows,
      seatsPerRow: opts.seatsPerRow,
      premiumRows: opts.premiumRows ?? 0,
    });
  if (res.status !== 201) throw new Error(`createVenue failed: ${JSON.stringify(res.body)}`);
  return res.body.venue;
}

/** Creates a show via the API as an organiser/admin token. Returns show id. */
export async function createShowT(
  token: string,
  opts: {
    venueId: string;
    title?: string;
    type?: 'MOVIE' | 'CONCERT';
    startsAt?: string;
    premiumPriceCents?: number;
    standardPriceCents?: number;
  },
): Promise<string> {
  const res = await request(app())
    .post('/api/shows')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: opts.title ?? 'Concert Test',
      type: opts.type ?? 'MOVIE',
      venueId: opts.venueId,
      startsAt: opts.startsAt ?? new Date(Date.now() + 86400000 * 3).toISOString(),
      premiumPriceCents: opts.premiumPriceCents ?? 2500,
      standardPriceCents: opts.standardPriceCents ?? 1200,
    });
  if (res.status !== 201) throw new Error(`createShow failed: ${JSON.stringify(res.body)}`);
  return res.body.show.id;
}

/** Fetches the seat map for a show. */
export async function fetchSeatMap(
  showId: string,
  token?: string,
): Promise<
  Array<{
    id: string;
    label: string;
    row: number;
    col: number;
    category: string;
    status: string;
    priceCents: number;
    holdExpiresAt: string | null;
    heldByMe: boolean | null;
  }>
> {
  const req = request(app()).get(`/api/shows/${showId}/seats/map`);
  if (token) req.set('Authorization', `Bearer ${token}`);
  const res = await req;
  if (res.status !== 200) throw new Error(`seatMap failed: ${JSON.stringify(res.body)}`);
  return res.body.seats;
}

export function holdApi(showId: string, token: string, seatIds: string[]) {
  return request(app())
    .post(`/api/shows/${showId}/seats/holds`)
    .set('Authorization', `Bearer ${token}`)
    .send({ seatIds });
}

export function book(showId: string, token: string, seatIds: string[]) {
  return request(app())
    .post('/api/bookings')
    .set('Authorization', `Bearer ${token}`)
    .send({ showId, seatIds });
}