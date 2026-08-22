# 🎟️ Ticket Booking System

A production-style ticket booking platform for **movies and concerts**: a visual seat map with
real-time availability, backend-enforced seat holds with automatic TTL release, strict
concurrency protection, an ordered per-category waitlist with time-limited offers on
cancellation, and QR-code tickets delivered by email.

> Built from the requirements in `Ticket_Booking_System (2).pdf`.

## Live Application

| | |
|---|---|
| **Frontend** | https://ticket-booking-system-frontend-seven.vercel.app |
| **Backend** | https://ticket-booking-system-mpdm.onrender.com |
| **Health** | https://ticket-booking-system-mpdm.onrender.com/api/health |

**Deployment architecture:** Frontend (Vercel, static SPA) → Backend (Render, Node.js/Express) → Neon PostgreSQL. Real-time updates via Socket.IO (WebSocket) over the same backend.

| | |
|---|---|
| Backend | Node.js 20 · Express · TypeScript · Socket.IO · Prisma |
| Database | PostgreSQL |
| Frontend | React 18 · Vite · TypeScript · Tailwind CSS |
| Auth | JWT + bcrypt, role-based (customer / organiser / admin) |
| Tests | Vitest + Supertest — **39 tests / 8 suites, all passing** |

---

## Table of contents

1. [Project overview](#1-project-overview) · 2. [Problem statement](#2-problem-statement) ·
3. [Features](#3-features) · 4. [Technology stack](#4-technology-stack) ·
5. [Architecture](#5-architecture) · 6. [Project structure](#6-project-structure) ·
7. [Database design](#7-database-design) · 8. [Authentication](#8-authentication) ·
9. [Seat map](#9-seat-map) · 10. [Seat hold mechanism](#10-seat-hold-mechanism) ·
11. [TTL mechanism](#11-ttl-mechanism) · 12. [Concurrency protection](#12-concurrency-protection) ·
13. [Booking flow](#13-booking-flow) · 14. [Cancellation](#14-cancellation) ·
15. [Waitlist](#15-waitlist) · 16. [Timed waitlist offers](#16-timed-waitlist-offers) ·
17. [Real-time updates](#17-real-time-updates) · 18. [QR & email](#18-qr--email) ·
19. [API overview](#19-api-overview) · 20. [Testing](#20-testing) · 21. [Security](#21-security) ·
22. [Local setup](#22-local-setup) · 23. [Environment variables](#23-environment-variables) ·
24. [Deployment](#24-deployment) · 25. [Troubleshooting](#25-troubleshooting) ·
26. [Engineering decisions](#26-engineering-decisions) · 27. [Limitations](#27-limitations) ·
28. [Future improvements](#28-future-improvements) · 29. [Final verification results](#29-final-verification-results) ·
30. [PDF requirement checklist](#30-pdf-requirement-checklist) ·
31. [Challenges faced and how I resolved them](docs/challenges-and-solutions.md)

## 1. Project overview

High-demand events sell out instantly while last-minute cancellations go to waste. This system
solves both sides of that problem:

1. Customers pick seats from a **live visual map**; selected seats are **held server-side** for a
   configurable window (default 10 minutes), and are **automatically released** if checkout is
   abandoned.
2. When an event (or a seat category) is **sold out**, customers join an ordered **waitlist**.
   The moment a booking is cancelled, the freed seat is **automatically offered to the next
   person in line** with a **time-limited acceptance link** — if they don't act in time, the
   offer cascades to the following customer. Accepted offers instantly become confirmed bookings
   with QR tickets.

Everything important is enforced **on the backend / in the database** — the client is treated as
untrusted UI.

## 2. Problem statement

- **Instant sell-outs** — many customers hit "book" simultaneously; naive check-then-write logic
  lets two people buy the same seat. Conflicting attempts must serialize at the database.
- **Abandoned checkouts** — users who select seats and leave must not block inventory forever.
- **Wasted cancellations** — freed seats should flow automatically to waiting customers in a
  fair order with a deadline, instead of silently returning to general availability while a
  queue exists.
- **Proof of purchase** — customers need a verifiable ticket (QR encoding the booking reference)
  delivered by email.

## 3. Features

### Customer
- Register / log in (JWT session).
- Browse events; filter by type (movie/concert), city, title search.
- Live visual seat map: available / held / booked / waitlist-offered + per-category prices.
- Multi-seat selection → 10-minute hold with visible countdown → confirm purchase.
- QR ticket by email; "My Bookings" history with inline QR; cancel bookings.
- Join the per-category waitlist when sold out; receive time-limited email offers with
  one-click accept/decline.

### Organiser
- Register as organiser; create listings (title, type, venue, start time, per-category prices).
- Booking summary & revenue per event: capacity, booked/available, bookings count, tickets
  sold, waitlist depth, revenue totals.

### Admin
- Create/delete venues with seat layout (rows × seats-per-row; first *N* rows Premium).
- Global platform summary (users, venues, shows, bookings, revenue).
- Trigger the expired-hold/offer sweep on demand (`POST /api/admin/scheduler/run`).
## 4. Technology stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 20 | LTS, first-class TypeScript |
| API | Express 4 + TypeScript | small, explicit, well-understood |
| Real-time | Socket.IO 4 | rooms per show, websocket + fallbacks |
| ORM | Prisma 6 | type-safe queries, interactive transactions, raw SQL when needed |
| Database | PostgreSQL 16 | row-level locks (`FOR UPDATE`) |
| Auth | `jsonwebtoken` + `bcryptjs` | stateless sessions, salted hashes |
| Email | Nodemailer | pluggable transport: console log (dev) or real SMTP |
| QR | `qrcode` | PNG data-URL generation |
| Validation | zod | schema validation at the route boundary |
| Frontend | React 18 + Vite + TS + Tailwind | fast DX, typed API layer |
| Frontend real-time | socket.io-client | shared seat-map updates |
| Testing | Vitest + Supertest (+ jsqr/pngjs) | fast TS runs; QR decoded back in tests |

## 5. Architecture

```
+------------+   HTTPS /api/*    +------------------+   Prisma   +------------+
|  React SPA | <---------------> |  Express + TS    | <--------> | PostgreSQL |
|  (Vite)    |   Socket.IO ws    |  Socket.IO server|            |            |
+------------+ <---------------+ +--------+---------+            +------------+
        seat:update / show:stats events   | setInterval scheduler
                                          v
                          expired holds -> AVAILABLE
                          expired offers -> next in queue
```

- The Express app is a **factory** (`createApp()`), so tests drive the exact production stack
  via Supertest without opening ports.
- Every seat-state mutation publishes a `seat:update` payload on an in-process event bus;
  `server.ts` forwards it to the Socket.IO room. Tests subscribe to the same bus.
- The **scheduler** runs in-process (`SCHEDULER_INTERVAL_MS`) - no extra worker service needed.

## 6. Project structure

```
backend/
  prisma/schema.prisma        all models & enums (docs/database-schema.md)
  prisma/seed.ts              realistic seed: venues, shows, users, sample booking
  src/config.ts               typed env config (TTLs, SMTP, JWT, CORS...)
  src/lib/                    prisma client, jwt, password, qr, email, event bus
  src/middleware/             requireAuth/optionalAuth/roles, zod validate, errors
  src/routes/                 auth, venues, shows, seats(map+holds), bookings,
                              waitlist(+offers), organiser, admin, health
  src/services/               hold, booking, cancellation, waitlist, scheduler,
                              show, venue, stats - all business logic
  src/app.ts                  express app factory
  src/server.ts               http + socket.io + scheduler bootstrap
  tests/                      vitest suites + factories + global setup
frontend/
  src/api.ts                  typed fetch wrapper + all endpoints
  src/socket.ts               socket.io client + useSeatUpdates hook
  src/auth.tsx                auth context (token in localStorage)
  src/components/             SeatMap, Countdown, Navbar, Protected route
  src/pages/                  Home, Login, Register, ShowDetail (map+hold),
                              MyBookings, OfferPage, OrganiserDashboard, AdminVenues
docs/
  api-documentation.md        every endpoint + socket events + curl examples
  database-schema.md          tables, state machines, invariants
  system-design.md            <=800-word design write-up (PDF deliverable)
  challenges-and-solutions.md genuine problems hit during development
DEVELOPMENT_LOG.md            chronological build log
```

## 7. Database design

Nine tables - full column reference in docs/database-schema.md:

- **User** - email (unique), bcrypt password, role.
- **Venue / Seat** - physical layout; Seat(row, col, label, category), unique per venue.
- **Show / Pricing** - event listing; Pricing(showId, category, priceCents) unique pair.
- **ShowSeat** - the heart of the system: one row per seat per show with
  status (AVAILABLE|HELD|BOOKED|OFFERED), heldById, holdExpiresAt, bookingId.
- **Booking / Ticket** - Booking.reference (unique TBS-XXXXXXXX) is what the QR encodes;
  one Ticket row per seat with its own QR data URL.
- **WaitlistEntry** - FIFO queue per (show, category) ordered by autoincrement position.
- **WaitlistOffer** - one time-limited token per offered seat with a status lifecycle.

ShowSeat state machine:

```
AVAILABLE --hold--> HELD --confirm--> BOOKED --cancel--> OFFERED (next in queue)
   ^                  | expiry                            |
   +------------------+     offer accepted: OFFERED --> BOOKED
                             offer expired:  OFFERED --> next WAITING or AVAILABLE
```

## 8. Authentication

- POST /api/auth/register accepts an optional role (CUSTOMER default, ORG, ADMIN),
  bcrypt-hashes the password (configurable rounds) and returns a signed JWT.
- JWT payload { sub: userId, role, email }, expiry JWT_EXPIRES_IN (default 7d).
- Middleware: requireAuth (mandatory) and optionalAuth (public endpoints that personalise
  responses, e.g. heldByMe on the seat map); plus role guards (requireAdmin,
  requireOrgOrAdmin). Ownership checks are enforced in services, not just at routes.

## 9. Seat map

- GET /api/shows/:id/seats/map returns every seat with row, col, label, category, status,
  priceCents, holdExpiresAt, heldByMe - prices merged from per-category pricing.
- The frontend renders a screen-style grid grouped by row, colour-coded by status with a
  legend; seats that are not AVAILABLE (or your own holds) are disabled.
- Live updates: the page joins the Socket.IO room and patches seat state in place; selections
  taken by someone else are automatically deselected.

## 10. Seat hold mechanism

POST /api/shows/:id/seats/holds { seatIds }:

1. Interactive transaction opens.
2. SELECT ... WHERE "showId"=$1 AND id IN (...) FOR UPDATE - row locks acquired.
3. Any row not AVAILABLE -> abort with 409 SEAT_CONFLICT; nothing is written.
4. Atomic conditional update sets HELD, heldById, holdStartedAt,
   holdExpiresAt = now + SEAT_HOLD_TTL_MS.
5. After commit the new state is broadcast to the room.

Release: POST /shows/:id/seats/holds/release flips only the callers held rows back to
AVAILABLE (the Abandon button in the UI).

## 11. TTL mechanism

Two independent server-side enforcement layers:

1. **Scheduler** - every SCHEDULER_INTERVAL_MS the backend sweeps
   status=HELD AND holdExpiresAt < now() back to AVAILABLE (batched, idempotent,
   broadcast per show).
2. **Booking-time revalidation** - confirming re-locks rows and rejects any whose deadline has
   passed (410 HOLD_EXPIRED), closing the gap between scheduler sweeps.

The same machinery governs **waitlist offers** (OFFERED seats + WaitlistOffer.expiresAt).
The frontend countdown is purely cosmetic.

## 12. Concurrency protection

- Conflicting requests serialize on the row lock: the loser blocks, re-reads the committed row,
  sees HELD/BOOKED, fails with 409 - no partial writes.
- A second atomic guard (UPDATE ... WHERE status=AVAILABLE) keeps the invariant even if the
  explicit lock were ever removed by refactoring.
- Booking/cancellation re-lock all affected rows and re-validate status/holder/TTL inside the
  transaction before writing.
- Isolation is READ COMMITTED (deliberate): correctness comes from row locks + conditional
  writes; SERIALIZABLEs spurious aborts between non-overlapping holds are avoided (a real issue
  hit during development - see docs/challenges-and-solutions.md).
- **Proof**: tests/concurrency.test.ts fires 20 parallel holds at one seat -> exactly 1x201,
  19x409, exactly one DB holder; plus overlapping multi-seat and double-book races.

## 13. Booking flow

1. POST /api/shows/:id/seats/holds -> hold + countdown.
2. POST /api/bookings { showId, seatIds } -> inside one transaction: re-lock, re-validate
   (holder/status/TTL), compute total from per-category pricing, create the Booking (unique
   TBS- reference), flip seats to BOOKED, create one Ticket per seat, generate the QR data URL,
   send the confirmation email.
3. Response carries reference, totals and QR; the email embeds the same QR.

## 14. Cancellation

POST /api/bookings/:id/cancel (owner, owning organiser, or admin):

1. Re-lock every seat of the booking; mark the booking CANCELLED (second cancel -> 409).
2. For each seat atomically pick the next WAITING entry for that category: seat -> OFFERED to
   that customer with a fresh WaitlistOffer (token + expiry), entry -> OFFERED;
   queue empty -> seat returns to AVAILABLE.
3. Offer emails (time-limited link) go out after commit; the seat map updates live.

## 15. Waitlist

- Join: POST /api/shows/:id/waitlist { category } - allowed only when that category has no
  AVAILABLE seats (otherwise 400); one active entry per user/show/category (duplicate -> 409).
- Ordering: position is a monotonic autoincrement - strict FIFO; next in line is always
  ORDER BY position ASC.
- Leave: DELETE cancels a WAITING entry.

## 16. Timed waitlist offers

- The offered seat is OFFERED and tied to exactly one customer + token + deadline
  (WAITLIST_OFFER_TTL_MS, default 10 min).
- **Accept** (POST /api/offers/:token/accept, owner only) runs the same locked booking
  protocol: seat -> BOOKED, offer -> ACCEPTED, entry -> COMPLETED, QR email sent.
  Expired -> 410 and the pass-on already happened; wrong user or resolved -> 409.
- **Decline** or scheduler expiry -> offer/entry EXPIRED -> the same seat is re-offered to the
  next position in the same transaction. It is never available to the general public while the
  queue has waiting customers, and never assigned to two people.

## 17. Real-time updates

join:show { showId } subscribes a socket; the server emits:

- seat:update { showId, seats:[{id,label,row,col,category,status,holdExpiresAt}] }
- show:stats { showId, stats:{available,held,booked,offered} }

Sources of events: holds, releases, bookings, cancellations, offer creation/expiry, TTL sweeps.

## 18. QR & email

- The QR payload is a JSON document: { system:TBS, ref, event, venue, startsAt, seats[],
  holder } - scannable and verifiable against the API. Generated as a PNG data URL, stored on
  the booking/tickets, embedded in the HTML email, and returned by the API for inline display.
- Mailer transports: EMAIL_TRANSPORT=log (console/dev/test - captured by the test suite) or
  smtp (any free-tier SMTP). Delivery is best-effort: failures are logged and never fail a
  booking.

## 19. API overview

Full reference with request/response shapes and curl examples:
docs/api-documentation.md. Summary:

| Area | Endpoints |
|---|---|
| Auth | POST /auth/register, POST /auth/login, GET /auth/me |
| Venues | GET/POST /venues, GET/DELETE /venues/:id |
| Shows | GET /shows?type&city&search, GET /shows/:id, POST /shows, POST /shows/:id/cancel |
| Seat map & holds | GET /shows/:id/seats/map, POST .../seats/holds, POST .../seats/holds/release |
| Bookings | POST /bookings, GET /bookings/my, GET /bookings/:id, POST /bookings/:id/cancel |
| Waitlist | POST/DELETE /shows/:id/waitlist |
| Offers | GET /offers/:token, POST /offers/:token/accept, POST /offers/:token/decline |
| Dashboards | GET /organiser/stats, GET /organiser/shows(/:id/bookings), POST /admin/scheduler/run |

## 20. Testing

npm test (root) runs the whole suite against a dedicated test database (TEST_DATABASE_URL);
vitest global setup pushes the Prisma schema automatically.

| Suite | Covers |
|---|---|
| concurrency.test.ts | 20-way hold race -> 1 winner; double-book race; overlapping multi-seat holds; 20-way race over two seats |
| holds-ttl.test.ts | hold lifecycle, second-customer 409, explicit release, TTL sweep (service + admin endpoint), expired hold cant book (410) |
| cancel-waitlist.test.ts | sold-out gating, duplicate-entry 409, FIFO offers on cancel, owner-only accept, decline->next-in-line, empty queue->AVAILABLE, double-cancel 409 |
| offer-ttl.test.ts | expiry window, scheduler pass-on, stale token 410, queue-empty release via admin endpoint |
| booking.test.ts | hold->book happy path (totals, QR, tickets, email), non-held 409, already-booked 409, history/ownership |
| venues-shows.test.ts | role guards, seat auto-generation, show provisioning, heldByMe, organiser revenue |
| auth.test.ts | register/login/me, duplicate email, bad credentials |
| qr.test.ts | QR round-trip decode contains the booking reference; reference uniqueness |

## 21. Security

- Passwords bcrypt-hashed; JWT signed with JWT_SECRET (env-provided).
- All mutations behind requireAuth; admin/organiser routes behind role middleware; ownership
  re-checked in services.
- zod validation on every request body; centralised error handler never leaks stack traces.
- Parameterised queries via Prisma; raw SQL limited to the locking statement with bound
  parameters (Prisma.sql / Prisma.join).
- CORS restricted via CORS_ORIGINS; .env files git-ignored (only .env.example committed).

## 22. Local setup

Prerequisites: Node 20+, PostgreSQL 14+.

```bash
npm install                                # installs both workspaces
cp backend/.env.example backend/.env       # adjust DATABASE_URL if needed
cd backend
npx prisma db push                         # dev DB
DATABASE_URL="postgresql://postgres:password@localhost:5432/ticket_booking_test" npx prisma db push
cd backend && npm run db:seed              # realistic seed data
cd .. && npm run dev                       # API :5000 + Vite :5173
```

Open http://localhost:5173 - seeded logins (password password123):
admin@tbs.dev, organiser@tbs.dev, promoter@tbs.dev, carlos@example.com, mia@example.com.

## 23. Environment variables

See .env.example and backend/.env.example:

| Variable | Default | Purpose |
|---|---|---|
| DATABASE_URL | postgresql://postgres:password@localhost:5432/ticket_booking | dev database |
| TEST_DATABASE_URL | .../ticket_booking_test | database used by vitest |
| PORT | 5000 | API port |
| JWT_SECRET / JWT_EXPIRES_IN | dev-secret / 7d | token signing |
| BCRYPT_ROUNDS | 10 | password hashing cost |
| SEAT_HOLD_TTL_MS | 600000 (10 min) | seat hold TTL |
| WAITLIST_OFFER_TTL_MS | 600000 (10 min) | offer link validity |
| SCHEDULER_INTERVAL_MS | 5000 | expired hold/offer sweep frequency |
| START_SCHEDULER | true | enable in-process scheduler |
| EMAIL_TRANSPORT | log | log (console) or smtp |
| SMTP_HOST/PORT/USER/PASS | - | real email delivery |
| EMAIL_FROM | Ticket Booking <tickets@example.com> | from header |
| FRONTEND_URL | http://localhost:5173 | used in offer links |
| CORS_ORIGINS | http://localhost:5173 | allowed browser origins |
| VITE_API_URL | https://ticket-booking-system-mpdm.onrender.com (prod) | frontend: API + Socket.IO base URL (empty = Vite dev proxy in local dev) |

## 24. Deployment

- docker-compose.yml - one-command local production-like stack (Postgres + API + nginx SPA).
- docs/deployment-guide.md - step-by-step Vercel (frontend) + Render (backend) + Neon
  (PostgreSQL) walkthrough with exact environment variables; render.yaml blueprint included.
- CI: .github/workflows/ci.yml - installs workspaces, builds backend and frontend, runs the
  full Vitest suite against a PostgreSQL service container.

## 25. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| P1001 cant reach database | Postgres not running or wrong DATABASE_URL; verify with psql |
| 401 on every call | token missing/expired; log in again; check JWT_SECRET matches the one that signed it |
| 409 SEAT_CONFLICT while seats look free | someone else (or another tab) holds them; the map updates in ~1s |
| 410 HOLD_EXPIRED at confirm | hold TTL passed; select seats again |
| Seat map not updating live | Socket.IO blocked; check /socket.io proxy (Vite dev) or nginx upgrade headers |
| Emails not arriving | EMAIL_TRANSPORT=log only prints; configure smtp transport for real delivery |
| Tests fail with P1001 | create the test DB and set TEST_DATABASE_URL; vitest pushes the schema itself |
| prisma P2002 on seed | database not empty; seed is idempotent-safe - truncate first (see docs/database-schema.md) |

## 26. Engineering decisions

- **Database as the only source of truth for seat state** - no in-memory locks; any stateless
  replica can serve traffic.
- **READ COMMITTED + FOR UPDATE + conditional updates** instead of SERIALIZABLE - same
  correctness for this access pattern without spurious aborts (see challenges doc).
- **App factory + event bus** - Supertest drives the real middleware stack; Socket.IO is a
  subscriber of the same events tests assert on.
- **Offer = seat state + token row** - accepting an offer reuses the exact booking protocol,
  so there is one code path that can create bookings from held seats.
- **position autoincrement** for waitlist ordering - O(1) enqueue, no read-modify-write races.
- **Awaited best-effort email** inside the request - deterministic for clients/tests, still
  never fails the booking (errors swallowed and logged).

## 27. Limitations

- Single-process scheduler and Socket.IO fan-out (scale-out needs the Redis adapter + a leader-
  elected scheduler or a job queue).
- No payments - totals are computed and stored but no gateway is integrated.
- Admin self-registration is open for demo convenience; lock down in production.
- Waitlist is per category, not per exact seat (by design, per the brief).
- Emails render as styled HTML but there is no attachment/PDF ticket.

## 28. Future improvements

- Redis Socket.IO adapter + BullMQ for multi-instance TTL sweeps.
- Stripe/Razorpay authorisation hold aligned with the seat-hold TTL.
- Per-seat waitlist preferences and multiple-seat offers.
- Rate limiting (express-rate-limit) and audit logging for admin actions.
- E2E browser tests (Playwright) covering the full UI journey.

## 29. Final verification results

Actual results from the final verification run (see DEVELOPMENT_LOG.md):

| Check | Result |
|---|---|
| Backend tests | 39/39 passed (8 suites), 26.3s |
| Backend typecheck (tsc --noEmit) | passed |
| Backend production build | passed |
| Frontend typecheck | passed |
| Frontend production build (Vite) | passed |
| E2E smoke (login -> map -> hold -> book -> QR -> history -> cancel) | passed against the running server |
| Concurrency proof (20 parallel holds, one seat) | exactly 1 success / 19 conflicts |
| QR decode round-trip | passed |

## 30. PDF requirement checklist

| Requirement (Ticket_Booking_System.pdf) | Status |
|---|---|
| Movies & concerts booking platform | done (MOVIE/CONCERT types, seeded both) |
| Visual seat map booking | done (grid UI + map API) |
| Held seats auto-release on abandonment | done (release endpoint + TTL sweep) |
| Sold-out waitlist with automatic assignment on cancellation | done (FIFO queue + offer flow) |
| Email with QR code ticket | done (QR encodes booking reference; decoded in tests) |
| Admin creates/manages venues with layout & categories | done (Premium/Standard rows) |
| Organiser registers, logs in, creates listings with venue/date/time/pricing | done |
| Customer registers, logs in, browses & filters events | done (type/city/search) |
| Visual seat map with real-time status | done (Socket.IO) |
| Hold with configurable TTL; held seats unavailable to others | done (SEAT_HOLD_TTL_MS) |
| Abandoned checkout auto-release + real-time update | done |
| Prevent two customers holding/booking same seat simultaneously | done + concurrency tests |
| QR encodes booking reference, delivered by email | done |
| Waitlist per seat category when sold out | done |
| Cancellation offers seat to next customer with time-limited link | done |
| Offer expiry passes seat to next in line | done (scheduler + decline) |
| Customer booking history + cancel | done |
| Organiser booking summary & revenue per event | done |
| Backend API + frontend + database, role-based auth | done |
| Seat map stored per show with per-seat status | done (ShowSeat) |
| TTL enforced via scheduler/database, not frontend | done |
| API docs, DB schema, setup guide, .env.example | done (docs/) |
| System design write-up (<=800 words) | done (docs/system-design.md, 692 words) |
| Hosted application URL | **Frontend**: https://ticket-booking-system-frontend-seven.vercel.app · **Backend**: https://ticket-booking-system-mpdm.onrender.com |

## Challenges faced and how I resolved them

See [docs/challenges-and-solutions.md](docs/challenges-and-solutions.md) for the genuine
problems encountered during development (Express route-param mounting, isolation-level false
conflicts, waitlist offer unique-constraint design, test-worker env leakage, and more), each
with investigation, root cause, fix and verification.
