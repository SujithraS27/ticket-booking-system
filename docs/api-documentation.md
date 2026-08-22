# API Documentation

Base URL: `http://localhost:5000/api` · Auth: `Authorization: Bearer <JWT>` · JSON bodies.

**Error shape**
```json
{ "error": { "code": "SEAT_CONFLICT", "message": "...", "details": [...] } }
```
Common codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `SEAT_CONFLICT` (409), `WAITLIST_CONFLICT` (409), `ALREADY_CANCELLED` (409), `HOLD_EXPIRED` (410).

---

## Health
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | – | `{ status, uptime, service }` |

## Auth
| Method | Path | Auth | Body / Response |
|---|---|---|---|
| POST | `/auth/register` | – | `{name,email,password,role?}` → 201 `{token,user}` (role: CUSTOMER/ORG/ADMIN) |
| POST | `/auth/login` | – | `{email,password}` → 200 `{token,user}` |
| GET | `/auth/me` | ✔ | → `{user}` |

## Venues (admin manages)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/venues` | ✔ any | list with seat counts |
| GET | `/venues/:id` | ✔ any | detail incl. all seats |
| POST | `/venues` | ADMIN | `{name,city,rows,seatsPerRow,premiumRows}` → 201; seats auto-generated (first N rows PREMIUM) |
| DELETE | `/venues/:id` | ADMIN | 409 if venue hosts shows |

## Shows / Events
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/shows?type=&city=&search=` | – | list + per-show stats `{available,held,booked,offered}` |
| GET | `/shows/:id` | – | detail with pricing |
| POST | `/shows` | ORG/ADMIN | `{title,type:"MOVIE"\|"CONCERT",venueId,startsAt(ISO),premiumPriceCents?,standardPriceCents?,prices?}` → 201; provisions ShowSeat for every venue seat |
| POST | `/shows/:id/cancel` | owning ORG / ADMIN | releases all seats |

## Seat map & holds — the concurrency-critical endpoints
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/shows/:showId/seats/map` | optional JWT | → `{showId, seats:[{id,label,row,col,category,status,priceCents,holdExpiresAt,heldByMe}]}`. `heldByMe=true` only for your own holds. |
| POST | `/shows/:showId/seats/holds` | ✔ customer | `{seatIds:[…]}` → 201 `{expiresAt, seats}`. **Atomic:** row locks + conditional update; a taken seat yields 409 `SEAT_CONFLICT`. TTL = `SEAT_HOLD_TTL_MS`. |
| POST | `/shows/:showId/seats/holds/release` | ✔ customer | `{seatIds}` → releases *your* held seats (checkout abandonment). |

## Bookings
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/bookings` | ✔ customer | `{showId,seatIds}` → 201 `{booking:{id,reference,totalCents,qrDataUrl,status},seats}`. Requires active holds owned by caller; expired → 410. Sends QR email. |
| GET | `/bookings/my` | ✔ | booking history incl. QR + seats |
| GET | `/bookings/:id` | ✔ owner | single booking |
| POST | `/bookings/:id/cancel` | ✔ owner / owning ORG / ADMIN | → 200 `{offersCreated:[{token,seatLabel,customerId,expiresAt}]}`. Seats auto-offered to waitlist FIFO or released. Idempotency guard: second cancel → 409. |

## Waitlist queue
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/shows/:showId/waitlist` | ✔ | `{category:"PREMIUM"\|"STANDARD"}` → 201 `{entry:{position,…}}`; 400 if category not sold out; 409 if already queued/offered |
| DELETE | `/shows/:showId/waitlist` | ✔ | leave queue (WAITING entries only) |

## Time-limited offers (waitlist)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/offers/:token` | – | offer metadata: show, seat, priceCents, status, expiresAt |
| POST | `/offers/:token/accept` | ✔ owner | → 201 `{reference,totalCents,qrDataUrl,seats}`; books the offered seat. Expired → 410 (+ auto pass-on); wrong user/resolved → 409 |
| POST | `/offers/:token/decline` | ✔ owner | passes seat to next in line immediately |

## Organiser / Admin dashboards
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/organiser/stats` | ORG (own) / ADMIN (global) | per-show: capacity/booked/bookings/ticketsSold/**revenueCents**/waitlist + totals |
| GET | `/organiser/shows` | ORG/ADMIN | listings overview |
| GET | `/organiser/shows/:showId/bookings` | owning ORG/ADMIN | booking list per show |
| POST | `/admin/scheduler/run` | ADMIN | manually run expired-hold/offer sweep → `{holdsReleased,offersResolved}` |

## Socket.IO events
Connect to server root, then:
- emit `join:show {showId}` → join room `show:{showId}`
- listen **`seat:update`**: `{showId, seats:[{id,label,row,col,category,status,holdExpiresAt}]}`
- listen **`show:stats`**: `{showId, stats:{available,held,booked,offered}}`

Emitted after every hold, release, expiry sweep, booking, cancellation and offer change.

## Example flow (curl)

```bash
TOKEN=$(curl -s -X POST localhost:5000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"carlos@example.com","password":"password123"}' | jq -r .token)

# hold two seats
curl -s -X POST localhost:5000/api/shows/$SHOW/seats/holds \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"seatIds":["<uuid1>","<uuid2>"]}'

# confirm purchase (QR ticket emailed)
curl -s -X POST localhost:5000/api/bookings \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"showId\":\"$SHOW\",\"seatIds\":[\"<uuid1>\",\"<uuid2>\"]}"
```
