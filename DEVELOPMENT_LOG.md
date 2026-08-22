# Development Log

Chronological record of how this project was actually built, verified, and debugged.
Every entry reflects real work performed in this repository; the problems encountered are
documented in detail in [`docs/challenges-and-solutions.md`](docs/challenges-and-solutions.md).

## Phase 0 — Specification

- Extracted the full text of `Ticket_Booking_System (2).pdf` programmatically (`pypdf`) to make
  sure no requirement was missed (2 pages: scope, technical expectations, deliverables,
  evaluation focus).

## Phase 1 — Environment

- Detected a running **PostgreSQL 18** Windows service and located `psql`.
- Discovered credentials by testing candidates; created dedicated databases
  `ticket_booking` (dev) and `ticket_booking_test` (tests).
- Confirmed Node v22 / npm 10 available.

## Phase 2 — Scaffolding

- npm-workspaces monorepo: root orchestration (`dev`, `build`, `test`, db scripts) +
  `backend/` + `frontend/`.
- Backend deps: express, socket.io, prisma, zod, bcryptjs, jsonwebtoken, nodemailer, qrcode;
  dev: vitest, supertest, tsx, typescript, jsqr/pngjs (QR round-trip proof).
- `.env.example` files at root/backend/frontend; `.gitignore` covering env, dist, logs.

## Phase 3 — Data model & backend

- Designed the Prisma schema: User, Venue, Seat, Show, Pricing, ShowSeat (per-show live state),
  Booking, Ticket, WaitlistEntry (FIFO `position`), WaitlistOffer (token + expiry).
- Implemented the services layer with the core invariants:
  - `hold.service.ts`: `SELECT ... FOR UPDATE` locking + atomic conditional update + TTL sweep.
  - `booking.service.ts`: shared locked booking protocol (used by direct bookings AND waitlist
    offer acceptance), QR generation, per-seat tickets.
  - `cancellation.service.ts`: locked cancel + hand-off into waitlist.
  - `waitlist.service.ts`: FIFO join/leave, offer creation/expiry/pass-on, accept/decline.
  - `scheduler.service.ts`: periodic expired-hold/offer sweep.
- Routes + zod validation + centralised error handler mapping domain errors to HTTP codes
  (`SEAT_CONFLICT`, `HOLD_EXPIRED`, ...).
- Socket.IO wired through an in-process event bus (`seat:update`, `show:stats`) so tests can
  observe events without sockets.
## Phase 4 - Database bring-up

- prisma generate + db push against dev and test databases.
- Fixed a corrupted schema head (stray TypeScript fragment left by an interrupted file write)
  flagged as P1012; validated clean afterwards.

## Phase 5 - Seed data

- Realistic seed: venues Grand Rex Hall / Nova Plex Cinema / Skyline Amphitheatre; 5 shows
  across Mumbai/Bengaluru/Chennai; admin + two organisers + two customers; one confirmed sample
  booking so dashboards/seat maps look alive.
- Fixed a seed crash (required qrDataUrl omitted on Ticket insert) and made the seed idempotent
  (skips when data already exists).

## Phase 6 - Test suite authoring

- Vitest global setup pushes the schema onto TEST_DATABASE_URL; per-file env setup pins the
  test database, disables the scheduler, forces NODE_ENV=test.
- Helpers: shared Supertest app instance, API-driven factories, per-test truncate.
- Suites authored: auth, venues-shows, holds-ttl, concurrency, booking, cancel-waitlist,
  offer-ttl, qr (with real QR decode via jsqr/pngjs).

## Phase 7 - Debugging marathon (all resolved; details in challenges doc)

Bugs found by the suite itself and fixed:

1. Route params lost when mounting a router on a parameterised path (showId undefined -> 500).
2. SERIALIZABLE isolation causing spurious 409s between non-overlapping holds -> moved to READ
   COMMITTED (row locks retained).
3. WaitlistOffer.showSeatId @unique blocked pass-on (P2002) -> relaxed to indexed columns plus
   a one-to-many relation.
4. Fire-and-forget emails raced test truncation -> delivery now awaited inside requests
   (best-effort, never fails the operation).
5. dotenv leaked NODE_ENV=development into vitest workers -> pinned NODE_ENV=test in setup.
6. Missing requireAuth before role guards on organiser/admin routes -> 401s.
7. Public seat-map route had no identity -> added optionalAuth so heldByMe works.
8. export { app } from ./app does not bind the local name -> ReferenceError in helpers.
9. Async test helpers returning Promises broke .expect() chaining -> return supertest Test.
10. Test-design fixes: category-correct seat selection, subject-string match, flat acceptOffer
    response shape, 1-seat/3-customer cascade scenario, order-independent offer->seat asserts.

Final state after this phase: **39/39 tests green**, repeated runs stable.

## Phase 8 - Builds

- Backend tsc build clean (CommonJS output, dist/server.js).
- Frontend tsc --noEmit && vite build clean after resolving a dual-vite-install type clash
  (excluded vite.config.ts from the app tsconfig include).

## Phase 9 - Frontend application

- Typed API client + Socket.IO hook (useSeatUpdates), auth context.
- Pages: Home (filters), Login/Register, ShowDetail (live map, hold countdown, abandon,
  confirm, waitlist join), MyBookings (QR + cancel), OfferPage (timed offer accept/decline),
  OrganiserDashboard (stats table + create listing), AdminVenues (layout builder).
- Tailwind styling kept functional; correctness prioritised over polish per the brief.

## Phase 10 - End-to-end verification

- Booted the built server; exercised health, login, show list, seat map, hold, book, history,
  cancel against seeded data. Booking reference TBS-RHL6ZK8W produced a valid PNG QR;
  cancellation released the seat with zero offers because that show had no waitlist - expected
  behaviour.
- Re-seeded the dev database after probe scripts intentionally dirtied it, then re-ran the
  smoke flow successfully.

## Phase 11 - Repository hygiene

- Removed probe scripts and logs; strengthened .gitignore.
- Verified .env files are ignored and only examples tracked; committed in two logical commits.

## Phase 12 - Release documentation

- This log, docs/challenges-and-solutions.md, expanded README (architecture, flows, security,
  troubleshooting, engineering decisions, limitations, roadmap, requirement checklist),
  deployment guide + Render blueprint, GitHub Actions CI workflow.

## Final verified state

| Check | Result |
|---|---|
| Backend tests | 39/39 passed (8 suites) |
| Backend typecheck + build | passed |
| Frontend typecheck + build | passed |
| E2E smoke against running server | passed |
| Concurrency proof | 1 success / 19 conflicts out of 20 parallel holds |
| QR decode round-trip | passed |
