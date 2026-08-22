# Challenges Faced and How I Resolved Them

Only problems that actually occurred while building this project are documented here.
Every fix below is covered by the automated test suite or a direct verification step described
in the entry.

---

## 1. Route parameters lost on a parameterised router mount

### Challenge
The seat-map endpoint returned HTTP 500 for valid show ids even though the underlying service
worked when called directly.

### Problem
`app.use('/api/shows/:showId/seats', seatRoutes)` mounted fine, but inside the routes
`req.params.showId` was `undefined`. Prisma then received `where: { id: undefined }` and threw
`PrismaClientValidationError`, surfaced as a generic 500.

### Investigation
- Reproduced the failing call with Supertest against `createApp()`; the error log pointed at
  `show.findUnique({ where: { id: undefined } })`.
- Isolated the layer by calling `getSeatMap(showId)` directly in a probe script — it returned
  correct results, proving the service was innocent and the routing layer dropped the param.

### Root Cause
Express does not reliably populate params declared on an `app.use()` mount path for nested
routers; relying on mount-path params was fragile.

### Solution
Mounted the seat router at `/api/shows` and made every path declare the parameter explicitly:
`GET /:showId/seats/map`, `POST /:showId/seats/holds`, `POST /:showId/seats/holds/release`.

### Verification
Full seat-map flow re-tested through Supertest (map → hold → heldByMe assertions) plus the
whole suite green afterwards.

### Lesson Learned
Declare path parameters on individual route definitions, not on the mount point, and add a
regression test that exercises real UUIDs end-to-end.

---

## 2. Serializable isolation caused false conflicts between non-overlapping holds

### Challenge
Under parallel load, holds for **different** seats occasionally failed with 409 even though no
seat overlapped — independent customers were interfering.

### Problem
`prisma.$transaction(..., { isolationLevel: 'Serializable' })` aborted transactions with P2034,
mapped by the API to `SEAT_CONFLICT`. With 40 concurrent requests, failures exceeded the
genuinely conflicting ones.

### Investigation
- The single-seat race behaved correctly (1 winner), but different-seat races failed
  intermittently — pointing at isolation behaviour rather than logic.
- PostgreSQL SSI semantics confirm read-write dependencies can abort transactions that never
  touched the same rows (false positives by design).

### Root Cause
SERIALIZABLE anomaly detection is deliberately conservative; using it for every hold traded
availability for guarantees that row locking already provided.

### Solution
Moved hold/booking/cancel/offer transactions to **READ COMMITTED**, keeping correctness via
(a) `SELECT … FOR UPDATE` row locks and (b) conditional updates
(`WHERE status = 'AVAILABLE'`) whose affected-row counts are asserted. After a lock is granted,
READ COMMITTED re-reads the latest committed version, so a loser always sees `HELD/BOOKED`.

### Verification
Probe firing 20×2 parallel holds produced exactly `{"201":2,"409":38}` with both seats HELD;
the concurrency suite stayed green across repeated full runs.

### Lesson Learned
Use the weakest isolation level that satisfies your invariant; let explicit row locks plus
conditional writes carry correctness instead of blanket SERIALIZABLE.
---

## 3. Unique constraint on waitlist offers blocked passing a seat to the next customer

### Challenge
Declining (or letting expire) a waitlist offer was supposed to hand the SAME seat to the next
person in line, but the operation failed and the endpoint returned an unexpected 409.

### Problem
WaitlistOffer.showSeatId was declared @unique. Expiring offer #1 and creating offer #2 for the
same seat violated it (P2002 UNIQUE_CONSTRAINT).

### Investigation
Test logs showed: Unique constraint failed on the fields: (showSeatId) - precisely during
decline/expiry flows. DB inspection confirmed the expired offer row still held the same
showSeatId, so any re-offer collided.

### Root Cause
Modelling a seat has at most one offer as a hard unique constraint ignored the temporal
dimension: over its lifetime a seat legitimately accumulates multiple offers - at most one may
be ACTIVE at any instant.

### Solution
- Removed @unique from entryId/showSeatId; added plain indexes for lookups.
- Changed ShowSeat.offer? (one-to-one requires uniqueness) to ShowSeat.offers[] one-to-many.
- Kept the real invariant in code: offers are created only inside transactions that transition
  the seat to OFFERED, and lookups always filter status = ACTIVE.

### Verification
New tests: decline cascades the same showSeatId to the next queue position; an expired token
returns 410 while the reassigned customer holds the ACTIVE offer; scheduler pass-on works;
queue-empty expiry releases the seat to AVAILABLE. All green.

### Lesson Learned
Uniqueness constraints must model the current-state invariant (one ACTIVE offer per seat), not
the full history - otherwise normal lifecycle transitions collide with the schema.

---

## 4. Fire-and-forget emails raced database resets in tests

### Challenge
Booking confirmation emails intermittently never appeared in the test mail capture, and the
server log showed PrismaClientUnknownRequestError: Inconsistent query result: Field venue is
required to return data, got null instead.

### Problem
Email delivery was launched as void deliverBookingEmail(...) after the response. In tests, the
next cases TRUNCATE could run while the detached tasks queries were still in flight; Prisma
executes include reads as separate statements, so the show row was read from a world where its
venue had already vanished.

### Investigation
Reproduced consistently by asserting mails immediately after booking; server logs contained the
exact inconsistent-join error originating in the delivery helper.

### Root Cause
Detached async work outliving the request lifecycle is unsafe when state resets between test
cases - and generally makes delivery success unobservable to clients.

### Solution
Delivery is now awaited within the request (booking creation, cancellation, offer acceptance)
while remaining best-effort internally: failures are caught and logged and never fail the
business operation. Outcomes became deterministic for clients and tests.

### Verification
Booking/cancellation/acceptance tests assert queued mails synchronously after the response -
stable across repeated full-suite runs.

### Lesson Learned
Fire-and-forget needs infrastructure (a durable queue) to be safe; without it, await the work
and contain its errors explicitly.

---

## 5. dotenv leaked NODE_ENV=development into test workers

### Challenge
The test-only email capture (sentMails) never recorded anything, so the confirmation-email
assertion failed even though the mailer code path executed.

### Problem
backend/.env contains NODE_ENV=development. Vitest sets NODE_ENV=test before running, but the
first module loaded by the test setup was dotenv/config, which populated NODE_ENV=development
(dotenv does not override already-set variables - and the value was not set yet at that point).

### Investigation
Probes printed process.env.NODE_ENV at several stages; it flipped to development right after
config loading inside workers.

### Root Cause
Storing NODE_ENV in .env is wrong, and the test harness must (re)assert environment identity
after all config loading.

### Solution
tests/setup-env.ts imports dotenv first and then pins process.env.NODE_ENV = test explicitly,
alongside the test database URL. Runtime checks evaluate after that point.

### Verification
Email-capture assertions pass deterministically in repeated full-suite runs, without sleeps.

### Lesson Learned
Never put NODE_ENV in .env; treat environment identity as belonging to the launcher, and
assert such assumptions in test setup.

---

## 6. Role-guarded routes returned 401 because requireAuth was missing

### Challenge
GET /api/organiser/stats and POST /api/admin/scheduler/run answered 401 for perfectly valid
organiser/admin tokens.

### Problem
Routes used only requireOrgOrAdmin / requireAdmin. Those guards check req.user, but nothing
populated it - requireAuth was never applied on those routes.

### Investigation
Traced the middleware chain for failing paths; AuthError(Not authenticated) originates exactly
where req.user is absent.

### Root Cause
Role middleware copied without the auth middleware it depends on.

### Solution
Prepended requireAuth before every role guard in organiser.routes.ts and admin.routes.ts,
matching the pattern used elsewhere.

### Verification
Organiser revenue test and admin scheduler-run test execute successfully; suite fully green.

### Lesson Learned
Compose guards from composable pieces, and give every privileged endpoint a positive auth+role
test - negative-only testing hides missing prerequisites.

---

## 7. Public seat-map endpoint had no identity, so heldByMe was always false

### Challenge
After holding a seat, the holders own map view still rendered the seat as held by someone
else; heldByMe was never true.

### Problem
GET /seats/map is public by design, so req.user did not exist; the serializer maps heldById ?
(userId ? heldById===userId : false) : null - always false for anonymous calls.

### Investigation
Compared map responses with and without tokens after a successful hold.

### Root Cause
No middleware attached an optional identity to public endpoints.

### Solution
Added optionalAuth middleware: decodes and attaches the user when a valid bearer token is
present, silently continues otherwise. Applied to the seat-map route.

### Verification
venues-shows.test.ts asserts heldByMe true for the holder and false for anonymous/other
viewers; holds-ttl covers the rest of the lifecycle.

### Lesson Learned
Public endpoints often still need optional identity for personalised responses - implement
optional auth once and reuse it.

---

## 8. Re-exporting a module does not bind the name locally (ReferenceError: app is not defined)

### Challenge
After introducing a shared test app helper, every suite failed with ReferenceError: app is not
defined inside helpers.ts.

### Problem
The file used `export { app } from './app';` - a pure re-export that does NOT create a local
binding, while the same file also called `app()` internally.

### Investigation
Stack traces pointed at the first `request(app())` call inside helpers; the import list had no
`app`.

### Root Cause
ES module re-export syntax vs. local binding confusion.

### Solution
`import { app } from './app'` plus an explicit `export { app }` when re-exposure is needed.

### Verification
All suites stopped throwing the ReferenceError and proceeded to real assertions.

### Lesson Learned
A re-export is not an import. If a module both uses and re-shares a symbol, import it and then
export it explicitly.

---

## 9. Async test helpers returned Promises, breaking supertest .expect() chaining

### Challenge
Several tests crashed with TypeError: holdApi(...).expect is not a function.

### Problem
Helpers were declared `async function holdApi(...) { return request(app())...; }`. Calling code
chained directly: `await holdApi(...).expect(201)` parses as awaiting
`holdApi(...).expect(201)` - but holdApi returns a Promise, which has no .expect.

### Investigation
TypeError location matched every direct-chain call site; non-chained awaits worked.

### Root Cause
async functions always wrap return values in a Promise.

### Solution
Removed async from request-helper functions (holdApi, book, joinWaitlist/join) so they return
the supertest Test object itself; both `await helper()` and `await helper().expect(n)` work.

### Verification
Full suite green; chaining style now uniform across tests.

### Lesson Learned
For fluent APIs (supertest), return the builder synchronously; reserve async for helpers that
must await internally before returning a value.

---

## 10. Interrupted file write left stray code at the top of schema.prisma (P1012)

### Challenge
prisma validate/generate started failing with P1012: This line is invalid... pointing at line 1
of schema.prisma containing `from "@prisma/client";`.

### Problem
An earlier editor write of the schema exceeded a size limit mid-operation, leaving a TypeScript
fragment as the first line of the Prisma file.

### Investigation
Read the first lines of the file after the CLI error displayed the offending line.

### Root Cause
Partial/truncated file write during generation of a very large single edit.

### Solution
Deleted the stray line; ran prisma format + validate until clean; adopted smaller chunked
writes for large files afterwards.

### Verification
prisma validate passed; generate/db push proceeded normally.

### Lesson Learned
Verify generated/config files parse immediately after large writes, and prefer chunked edits
for big files so failures are visible and localised.

---

## 11. Seed crashed on a required field, and the idempotent guard hid the partial state

### Challenge
The first seed run failed mid-way; the second run reported Seeding skipped - database already
contains data, leaving the dev database half-populated and confusing to debug.

### Problem
ticket.createMany omitted qrDataUrl (a required column), throwing after users/venues/shows were
already created. The skip-if-populated guard then refused to re-run.

### Investigation
Error trace pointed at seed.ts createMany; counting rows per table showed partial data.

### Root Cause
Required field missing + non-transactional seed with an existence-based early exit.

### Solution
Added the missing qrDataUrl value, truncated all tables (via psql -f with a SQL file - see
challenge 12), re-ran the seed successfully.

### Verification
Row counts: 5 users / 3 venues / 5 shows / 532 show seats / 296 seats; sample booking present.

### Lesson Learned
Wrap multi-step seeds in a transaction (or make every step idempotent), and never let an
existence guard mask a failed prior run.

---

## 12. PowerShell stripped double quotes from psql arguments, breaking TRUNCATE statements

### Challenge
Resetting the dev database via psql -c TRUNCATE TABLE "User", ... kept failing with syntax
errors near User (a reserved keyword) because embedded quotes vanished before reaching psql.

### Problem
Passing SQL containing double quotes through PowerShell native-command invocation mangles
quoting; backslash-escaped variants made it worse.

### Investigation
Echoed the received statement via psql error output; quotes were gone regardless of quoting
style tried inline.

### Root Cause
PowerShell-to-native-exe argument passing plus cmd.exe interpolation on Windows.

### Solution
Wrote the SQL to truncate.sql (plain file, correct quoting) and invoked `psql -f truncate.sql`.
The same file now serves test/dev resets reliably.

### Verification
TRUNCATE TABLE succeeded; row counts confirmed empty; seed re-ran cleanly afterwards.

### Lesson Learned
On Windows shells, avoid inline SQL with quoted identifiers in command arguments - put such
statements in files and execute them with -f.

---

## 13. Dual Vite installs caused TS2769 plugin type mismatch on vite.config.ts

### Challenge
Frontend typecheck failed: No overload matches this call for the react() plugin inside
vite.config.ts, complaining that vite types from root node_modules and frontend/node_modules
were incompatible.

### Problem
npm workspaces hoisted one Vite version to the root while another remained local; the app
tsconfig included vite.config.ts, so both type universes collided.

### Investigation
Error text named both import paths explicitly (node_modules/vite vs frontend/node_modules/vite).

### Root Cause
Two vite copies + including a Node-context config file in the DOM-oriented app tsconfig.

### Solution
Removed vite.config.ts from tsconfig include (Vite validates its own config at runtime/build).
Application code stays strictly type-checked.

### Verification
tsc --noEmit exits 0; vite build succeeds.

### Lesson Learned
Keep build-tool config files out of the application tsconfig program, or give them a dedicated
node-flavoured tsconfig project reference.

---

## 14. Production frontend returned 404 because API requests used relative /api URLs

### Challenge
After deploying the frontend to Vercel and the backend to Render, the live frontend showed
"Request failed (404)" on every API call and failed to connect via Socket.IO, even though the
backend's /api/health endpoint worked when called directly.

### Problem
rontend/src/api.ts used etch('/api') and rontend/src/socket.ts used io('/').
These are **relative** URLs that only resolve correctly through the Vite development proxy
(ite.config.ts forwards /api and /socket.io to http://localhost:5000). In production,
Vercel serves the static SPA at its own origin, so /api resolved to
https://ticket-booking-system-frontend-seven.vercel.app/api � a 404 on Vercel's static host.
The backend's real URL (https://ticket-booking-system-mpdm.onrender.com) was ignored.

### Investigation
- Confirmed the backend was reachable directly: curl https://ticket-booking-system-mpdm.onrender.com/api/health returned {"status":"ok",...}.
- Opened browser DevTools on the live Vercel frontend ? Network tab showed requests going to https://ticket-booking-system-frontend-seven.vercel.app/api/... (wrong origin) and receiving 404.
- Verified VITE_API_URL was already set in the Vercel project environment to https://ticket-booking-system-mpdm.onrender.com.
- Confirmed ite.config.ts only configures a dev-server proxy (no production proxying on Vercel).

### Root Cause
The frontend API client and Socket.IO client had no production-aware logic to use VITE_API_URL.
They relied entirely on Vite's dev proxy, which does not exist in the Vercel-hosted production build.

### Solution
Made a minimal change to two frontend files (no application-logic change):

1. **rontend/src/api.ts**: Added a BASE_URL constant derived from import.meta.env.VITE_API_URL || ''. The etch call changed from etch('/api') to etch('/api', ...). When VITE_API_URL is empty (local dev), this produces a relative /api URL routed through the Vite proxy (unchanged local behavior). When set (production), it produces the full https://ticket-booking-system-mpdm.onrender.com/api/... URL.

2. **rontend/src/socket.ts**: Changed io('/') to io(BASE_URL, ...) using the same VITE_API_URL constant. Empty string = connect to current origin (proxy forwards in dev); the Render URL = direct cross-origin WebSocket connection in production.

3. **rontend/tsconfig.json**: Added "types": ["vite/client"] so that 	sc --noEmit (the first step in 
pm run build) recognises import.meta.env.VITE_* properties. This is a standard Vite type-configuration, not application logic.

### Verification
- 
px tsc --noEmit exits 0.
- 
pm run build succeeds: 	sc --noEmit && vite build produces dist/ with no errors (239 kB JS, 76 kB gzipped).
- Built JS confirmed to contain the Render URL when built with VITE_API_URL=https://ticket-booking-system-mpdm.onrender.com: constant "https://ticket-booking-system-mpdm.onrender.com" found in minified JS output. When built without the variable, it bakes in an empty string (fallback to relative /api, preserving local-dev behavior).

### Lesson Learned
Production deployments of Vite frontends always need an explicit VITE_API_URL consumed by the API client. Relative /api calls only work through a dev proxy; never assume Vercel/Nginx-style rewrite rules unless explicitly configured. Wire import.meta.env.VITE_* into the client at build time and type-check it with ite/client types.
