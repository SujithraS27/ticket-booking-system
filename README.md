### Seeded accounts (password `password123`)

| Email | Role |
|---|---|
| `admin@tbs.dev` | ADMIN |
| `organiser@tbs.dev` | ORG |
| `promoter@tbs.dev` | ORG |
| `carlos@example.com` | CUSTOMER |
| `mia@example.com` | CUSTOMER |

## Running tests

```bash
npm test          # from repo root (or: cd backend && npm test)
```

The suite runs against the dedicated **test database** (`TEST_DATABASE_URL`, schema pushed
automatically by vitest global setup). Coverage of the critical paths:

| Suite | What it proves |
|---|---|
| `tests/concurrency.test.ts` | 20 parallel holds on ONE seat → exactly 1×201, 19×409, single DB holder; two customers can't book the same held seat; overlapping multi-seat holds don't partially succeed |
| `tests/holds-ttl.test.ts` | hold → HELD; second customer blocked; explicit release; automatic TTL release (service + admin endpoint); expired hold cannot be booked (410) |
| `tests/cancel-waitlist.test.ts` | sold-out gating, duplicate-entry guard, FIFO offers on cancellation, only-owner accept, decline→next-in-line, empty queue → AVAILABLE |
| `tests/offer-ttl.test.ts` | offer expiry window, expired offer passed to next customer, stale token rejected 410 even after reassignment, queue-empty release via admin endpoint |
| `tests/booking.test.ts` | hold→book happy path, QR data URL, tickets persisted, confirmation email queued, history & ownership rules |
| `tests/qr.test.ts` | generated QR is decoded back with a real QR reader and contains the booking reference |

## Configuration (see `.env.example`)

Key variables: `DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET`,
`SEAT_HOLD_TTL_MS` (**seat hold TTL**, default 600000 = 10 min),
`WAITLIST_OFFER_TTL_MS` (**offer link validity**, default 10 min),
`SCHEDULER_INTERVAL_MS`, `EMAIL_TRANSPORT=log|smtp` (+ `SMTP_*`), `FRONTEND_URL`, `CORS_ORIGINS`.

All TTLs are enforced **by the backend/database**, never by the client.

## Deployment

### Docker Compose (one command)

```bash
docker compose up --build
# web  → http://localhost:8080
# api  → http://localhost:5000/api
```

Provides PostgreSQL 16, the API (Prisma schema pushed on boot) and an nginx-served SPA that
proxies `/api` and `/socket.io` to the API container.

### Hosted platforms

The API deploys cleanly to Render/Railway/Fly (set env vars, use a managed Postgres,
run `npx prisma db push && node dist/server.js`); the SPA deploys to Vercel/Netlify
(build `npm run build --workspace frontend`, output `frontend/dist`).

## Documentation

- [`docs/api-documentation.md`](docs/api-documentation.md) — every endpoint + Socket.IO events + curl examples
- [`docs/database-schema.md`](docs/database-schema.md) — tables, state machines, invariants
- [`docs/system-design.md`](docs/system-design.md) — seat hold/TTL, concurrency prevention, waitlist auto-assignment & timed offers

## Git / GitHub

The repository is commit-ready (clean `.gitignore`, no secrets committed — only `.env.example`
files). To publish:

```bash
git remote add origin git@github.com:<you>/ticket-booking-system.git
git push -u origin master
```

A GitHub Actions workflow (`.github/workflows/ci.yml`) installs workspaces, typechecks,
builds and runs the full Vitest suite against a PostgreSQL service container.
# 🎟️ Ticket Booking System

A production-style ticket booking platform for **movies and concerts** with a visual seat map,
backend-enforced seat holds (configurable TTL with automatic release), strict concurrency
protection, an ordered waitlist per seat category with automatic time-limited offers on
cancellation, and QR-code tickets delivered by email.

> Built from the requirements in `Ticket_Booking_System (2).pdf`.

## Feature highlights

- 🔐 **Role-based auth** — customer / organiser / admin (JWT + bcrypt)
- 🏟️ **Venue & layout management** (admin) with auto-generated Premium/Standard rows
- 🎬 **Event listings** (organisers): venue, date/time, per-category pricing
- 🪑 **Visual seat map** with live status (`available / held / booked / offered`) via Socket.IO
- ⏳ **Seat holds** with configurable TTL (default 10 min) + automatic expired-hold release scheduler
- 🔒 **Concurrency-safe** holds & bookings — PostgreSQL row locks + atomic updates; simultaneous attempts for one seat never both succeed *(proven by automated tests)*
- 📨 **Waitlist** — real FIFO queue per show + category; cancellation hands the freed seat to the next customer automatically
- ⏱️ **Time-limited offers** — email link valid for `WAITLIST_OFFER_TTL_MS`; expiry passes the seat to the next in line
- 🧾 **QR tickets** — booking reference encoded as QR (PNG data URL) and emailed via Nodemailer
- 💸 **Organiser dashboard** — bookings count + revenue per event; admin summary
- ✅ **Tested** — Vitest + Supertest suite incl. dedicated concurrency proof and QR decode test

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 · Vite · TypeScript · Tailwind CSS · socket.io-client |
| Backend | Node.js · Express · TypeScript · Socket.IO |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (`jsonwebtoken`) + bcrypt hashing |
| Email | Nodemailer (log transport for dev, SMTP for prod) |
| QR | `qrcode` |
| Tests | Vitest + Supertest (+ `jsqr`/`pngjs` to decode generated QRs) |

## Repository layout

```
├── backend/
│   ├── prisma/            # schema.prisma + seed.ts
│   ├── src/
│   │   ├── config.ts      # env-driven configuration (TTLs, SMTP, JWT…)
│   │   ├── lib/           # prisma, jwt, password, qr, email, events, seatEvents
│   │   ├── middleware/    # auth (JWT+roles), zod validation, error handler
│   │   ├── routes/        # auth, venues, shows, seats(map/holds), bookings,
│   │   │                  # waitlist(+offers), organiser, admin
│   │   ├── services/      # hold, booking, cancellation, waitlist, scheduler…
│   │   ├── app.ts         # express app factory (used by tests too)
│   │   └── server.ts      # http + socket.io bootstrap + scheduler
│   └── tests/             # vitest suites
├── frontend/              # React SPA
├── docs/                  # api-documentation.md · database-schema.md · system-design.md
├── docker-compose.yml     # postgres + backend + frontend(nginx)
└── .github/workflows/ci.yml
```

## Quick start (local)

Prerequisites: **Node 20+**, **PostgreSQL 14+** running locally.

```bash
# 1. install everything (npm workspaces)
npm install

# 2. configure the backend
cp backend/.env.example backend/.env
#    edit DATABASE_URL / TEST_DATABASE_URL if your Postgres creds differ
#    default: postgresql://postgres:password@localhost:5432/ticket_booking

# 3. create databases + push schema + seed realistic data
cd backend
npx prisma db push                       # dev database
DATABASE_URL="postgresql://postgres:password@localhost:5432/ticket_booking_test" \
  npx prisma db push                     # test database (used by vitest)
npm run db:seed
cd ..

# 4. run backend (5000) + frontend (5173) together
npm run dev
```

Open **http://localhost:5173**.