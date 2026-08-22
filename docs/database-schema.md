# Database Schema — Ticket Booking System

PostgreSQL via Prisma. Schema source: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

## Entity relationship overview

```
Venue 1──* Seat 1───────* ShowSeat *──1 Show *──1 Venue (loop)
User 1──* Show (organiser)
Show 1──* Pricing
User 1──* Booking 1──* Ticket
Booking 1──* ShowSeat (bookingId)         ← seat ownership
User 1──* ShowSeat (heldById)             ← current holder
Show 1──* WaitlistEntry 1──* WaitlistOffer *──1 ShowSeat
```

## Enums

| Enum | Values | Purpose |
|---|---|---|
| `Role` | `ADMIN`, `ORG`, `CUSTOMER` | Role-based auth |
| `ShowType` | `MOVIE`, `CONCERT` | Event type |
| `SeatCategory` | `PREMIUM`, `STANDARD` | Seat class + pricing tier |
| `SeatStatus` | `AVAILABLE`, `HELD`, `BOOKED`, `OFFERED` | Per-show live seat state |
| `BookingStatus` | `CONFIRMED`, `CANCELLED` | |
| `WaitlistEntryStatus` | `WAITING`, `OFFERED`, `COMPLETED`, `EXPIRED`, `CANCELLED` | Queue lifecycle |
| `WaitlistOfferStatus` | `ACTIVE`, `ACCEPTED`, `EXPIRED` | Offer lifecycle |

## Tables

### User
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | text UNIQUE | login identifier, lowercased |
| name / password | text | bcrypt hash in `password` |
| role | Role | default `CUSTOMER` |

### Venue / Seat (physical layout)
- **Venue**: `name`, `city`, `rows`, `seatsPerRow`, `premiumRows`.
- **Seat**: `venueId FK`, `row`, `col`, `label` (`A7`), `category`. `UNIQUE(venueId,row,col)`; rows `1..premiumRows` are PREMIUM.

### Show / Pricing (event listing)
- **Show**: `title`, `type`, `description`, `venueId FK`, `organizerId FK`, `startsAt`.
- **Pricing**: `showId FK`, `category`, `priceCents`; `UNIQUE(showId,category)`.

### ShowSeat — the live seat map (core of hold/TTL logic)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | referenced by holds/bookings/offers |
| showId / seatId | uuid FKs | `UNIQUE(showId,seatId)` |
| status | SeatStatus | `AVAILABLE → HELD → BOOKED`, or `→ OFFERED` via waitlist |
| heldById | uuid? FK User | who holds/owns/holds-offer |
| holdExpiresAt | timestamptz? | TTL deadline for HELD and OFFERED |
| bookingId | uuid? FK Booking | set when BOOKED |
Indexes: `(showId,status)`, `(status,holdExpiresAt)` for scheduler scans.

**State machine**
```
AVAILABLE ──hold(user,TTL)──► HELD ──confirm──► BOOKED ──cancel──► OFFERED/AVAILABLE
   ▲                            │ expiry                             │
   └────────TTL expiry──────────┘        offer accepted: OFFERED ────┘ → BOOKED
                                         offer expired: OFFERED → next WAITING or AVAILABLE
```

### Booking / Ticket
- **Booking**: `reference` UNIQUE human code (`TBS-XXXXXXXX`), `showId`, `userId`, `totalCents`, `status`, `qrDataUrl` (PNG data URL), timestamps.
- **Ticket**: one per seat per booking — `bookingId FK`, `showId`, `seatId`, `seatLabel`, `category`, `qrDataUrl`.

### WaitlistEntry — ordered FIFO queue
| Column | Notes |
|---|---|
| showId, userId, category | queue scope |
| status | WAITING/OFFERED/COMPLETED/EXPIRED/CANCELLED |
| position | BigInt autoincrement — strict FIFO ordering key |
Index `(showId,category,status,position)` serves "next in line".

### WaitlistOffer — time-limited link
| Column | Notes |
|---|---|
| entryId FK | which waitlist customer |
| showSeatId FK | which released seat (history kept; multiple offers per seat over time) |
| token | UNIQUE random string used in email links |
| expiresAt | `now + WAITLIST_OFFER_TTL_MS` |
| status | ACTIVE / ACCEPTED / EXPIRED |
| acceptedBookingId | set when converted to a booking |

## Invariants enforced by services (transactions)

1. A seat can be held only from `AVAILABLE`, by exactly one user (`FOR UPDATE` + conditional update).
2. `HELD`/`OFFERED` seats carry a hard `holdExpiresAt`; expired rows are reverted by the scheduler.
3. `BOOKED` seats keep exactly one active `bookingId`; cancellation clears it and reassigns via waitlist atomically.
4. At most one ACTIVE offer exists per seat at any moment; offers always target the lowest `position` WAITING entry.

## Migrations & seeding

```bash
cd backend
npx prisma db push          # dev/test sync
npx prisma db seed          # realistic venues/shows/users/sample booking
```
