import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { app } from './app';

export { app };

export type TestAgent = { app: Express; auth: (token: string) => request.Test };

export function makeAgent(): TestAgent {
  const app = createApp();
  return {
    app,
    auth: (token: string) => request(app).set('Authorization', `Bearer ${token}`),
  };
}

/**
 * Wipes every table. Called before each test to guarantee isolation.
 * (Position autoincrement counters are also reset.)
 */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Ticket", "WaitlistOffer", "WaitlistEntry", "Booking", "ShowSeat", "Pricing", "Show", "Seat", "Venue", "User" RESTART IDENTITY CASCADE',
  );
}

interface DtoUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function registerUser(role: 'CUSTOMER' | 'ORG' | 'ADMIN', email?: string): Promise<{ token: string; user: DtoUser }> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const payload = {
    name: `Test ${role} ${suffix}`,
    email: email ?? `${role.toLowerCase()}-${suffix}@example.com`,
    password: 'password123',
    role,
  };
  const res = await request(app()).post('/api/auth/register').send(payload);
  if (res.status !== 201) {
    throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  }
  return res.body as { token: string; user: DtoUser };
}

export async function loginUser(email: string): Promise<string> {
  const res = await request(app()).post('/api/auth/login').send({ email, password: 'password123' });
  if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.body)}`);
  return res.body.token;
}

interface VenueT {
  id: string;
  rows: number;
  seatsPerRow: number;
  premiumRows: number;
}

export async function createVenueToker(token: string, over: Partial<{ name: string; city: string; rows: number; seatsPerRow: number; premiumRows: number }> = {}): Promise<VenueT> {
  const res = await request(app())
    .post('/api/venues')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: over.name ?? 'Test Arena', city: over.city ?? 'Testville', rows: over.rows ?? 3, seatsPerRow: over.seatsPerRow ?? 4, premiumRows: over.premiumRows ?? 1 });
  if (res.status !== 201) throw new Error(`createVenue failed: ${JSON.stringify(res.body)}`);
  return res.body.venue;
}

export async function createShow(
  token: string,
  opts: { venueId: string; title?: string; type?: string; startsAt?: string; premiumPriceCents?: number; standardPriceCents?: number },
): Promise<{ id: string }> {
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
  return res.body.show;
}

/** Fetches the seat map and returns raw seat DTOs. */
export async function seatMap(showId: string, token?: string) {
  const req = request(app()).get(`/api/shows/${showId}/seats/map`);
  if (token) req.set('Authorization', `Bearer ${token}`);
  const res = await req;
  if (res.status !== 200) throw new Error(`seatMap failed: ${JSON.stringify(res.body)}`);
  return res.body.seats as Array<{
    id: string;
    label: string;
    row: number;
    col: number;
    category: string;
    status: string;
    priceCents: number;
    holdExpiresAt: string | null;
  }>;
}

export async function holdSeats(showId: string, token: string, seatIds: string[]) {
  return request(app())
    .post(`/api/shows/${showId}/seats/holds`)
    .set('Authorization', `Bearer ${token}`)
    .send({ seatIds });
}

export async function bookSeats(showId: string, token: string, seatIds: string[]) {
  return request(app())
    .post('/api/bookings')
    .set('Authorization', `Bearer ${token}`)
    .send({ showId, seatIds });
}