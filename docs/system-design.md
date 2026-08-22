# System Design — Ticket Booking System

*Scope: seat hold & TTL mechanism, concurrency prevention, waitlist auto-assignment, and time-limited offer handling (~800 words).*

## Overview

Three-tier deployment: a React/Vite SPA, an Express + TypeScript API that also hosts Socket.IO, and PostgreSQL accessed through Prisma. Seat state is stored **per show** (`ShowSeat` rows), one row per physical venue seat, with status `AVAILABLE | HELD | BOOKED | OFFERED`. The database — never frontend state — is the single source of truth.

## Data model essentials

`Venue → Seat` defines the physical layout (row/col/category). Creating a `Show` clones every seat into `ShowSeat` rows and attaches per-category `Pricing`. A `Booking` owns seats via `ShowSeat.bookingId`; each seat keeps `heldById`, `holdExpiresAt`, and `holdStartedAt`. The waitlist is two tables: `WaitlistEntry` (FIFO queue, ordered by a monotonic `position`, scoped per show + category) and `WaitlistOffer` (one time-limited link token per offered seat).

## Seat hold + TTL

Selecting seats calls `POST /shows/:id/seats/holds`. Inside an interactive transaction we run:

```sql
SELECT id, status FROM "ShowSeat"
WHERE "showId" = $1 AND "id" IN ($2…) FOR UPDATE;
```

If any row is not `AVAILABLE` the transaction aborts with `409 SEAT_CONFLICT`. Otherwise an atomic conditional update sets `HELD`, stamps the holder, and writes `holdExpiresAt = now + SEAT_HOLD_TTL_MS` (configurable; default 10 minutes). A second guard — `UPDATE … WHERE status = 'AVAILABLE'` — makes double-holds impossible even under plan changes.

TTL enforcement is purely server-side, at two layers:

1. **Scheduler** — `setInterval(SCHEDULER_INTERVAL_MS)` scans `status='HELD' AND holdExpiresAt < now()` and flips those rows back to `AVAILABLE`, clearing holder fields; every change is pushed to Socket.IO room `show:{id}`.
2. **Booking-time check** — confirming a booking re-locks the rows and rejects any whose `holdExpiresAt` is already past (`410 HOLD_EXPIRED`), so a stale hold can never be converted between scheduler ticks.

Checkout abandonment is handled identically: either the client calls `/seats/holds/release` immediately, or the TTL reaper collects the seats.

## Concurrency prevention

Two customers racing for the same seat serialize on the row lock: T1 locks, holds, commits; T2's `FOR UPDATE` blocks on T1's lock, then re-reads the committed row, sees `HELD`, and fails with 409. Booking repeats the same protocol — rows are re-locked and re-validated (status, holder identity, TTL) before any write — so simultaneous confirms cannot both succeed. Cancellations re-lock all seats of the booking before mutating them. We use READ COMMITTED isolation deliberately: correctness comes from row locking plus conditional updates, while SERIALIZABLE's snapshot-abort false positives are avoided. An automated Vitest suite fires 20+ parallel requests at one seat through Supertest and asserts exactly one 201, the rest 409, and exactly one holder in the database.

## Waitlist auto-assignment

Customers join a sold-out category via `POST /shows/:id/waitlist`, creating a `WAITING` entry appended by autoincrementing `position` — a strict FIFO queue per show + category. When a booking is cancelled, inside the same transaction each freed seat is handed to the queue head: the entry becomes `OFFERED`, the seat becomes `OFFERED` (holder = that customer, `holdExpiresAt` = offer deadline), and a `WaitlistOffer` row stores a random `token` plus expiry. If the queue is empty the seat simply returns to `AVAILABLE`.

The customer receives an email containing `{FRONTEND_URL}/offers/{token}` — valid only until `expiresAt` (`WAITLIST_OFFER_TTL_MS`). Accepting converts the seat to `BOOKED` atomically (same locked protocol as normal checkout), marks the offer `ACCEPTED`, completes the entry, and emails a QR ticket. Declining or letting the timer lapse flips offer + entry to `EXPIRED` and immediately re-offers the same seat to the next position. Because assignment happens inside the cancellation/expiry transaction, two customers can never claim one seat: the seat transitions directly from one holder to the next, and only the offer owner's token can convert it. Expired tokens are rejected with `410` even if someone replays them.

## Real-time fan-out

Every mutation publishes a `seat:update` payload (seat ids, labels, categories, statuses) on an in-process event bus; Socket.IO forwards it to subscribers of `show:{showId}`, so all open browsers see holds/releases/bookings/offers within milliseconds, including automatic TTL releases.

## Tickets, email & operations

Bookings generate a QR data-URL encoding a JSON payload (booking reference, event, seats, holder); Nodemailer delivers the HTML ticket with the embedded QR (log transport in dev, SMTP in production). Everything is configurable via environment variables; Docker Compose provides Postgres + API + web, and the scheduler runs in-process so no extra worker is required.
