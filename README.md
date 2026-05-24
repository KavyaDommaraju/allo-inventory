# Allo Health — Inventory & Reservation Platform

A Next.js application that solves the checkout race-condition problem: inventory is temporarily held while a customer completes payment, then either confirmed (stock decremented permanently) or released (stock returned to pool).

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 App Router + TypeScript | Required by spec |
| Database | PostgreSQL via Prisma ORM | Hosted on Supabase / Neon |
| Cache / Lock | Redis via ioredis | Distributed locking + idempotency |
| Validation | Zod | Shared between API layer and forms |
| Styling | Tailwind CSS | Fast, consistent UI |

---

## Running locally

### Prerequisites

- Node 18+
- A hosted Postgres instance (Supabase, Neon, or Railway — all free tiers work)
- A hosted Redis instance (Upstash free tier works)

### Setup

```bash
git clone <repo>
cd allo-inventory
npm install

# Copy env template and fill in your values
cp .env.example .env.local
# Edit .env.local: DATABASE_URL and REDIS_URL are required

# Push schema to database and generate Prisma client
npm run db:push

# Seed with demo data (5 products, 3 warehouses, 12 stock rows)
npm run db:seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API reference

| Method | Path | Behaviour |
|---|---|---|
| `GET` | `/api/products` | List all products with available stock per warehouse |
| `GET` | `/api/warehouses` | List all warehouses |
| `POST` | `/api/reservations` | Reserve units — 409 if insufficient stock |
| `GET` | `/api/reservations/:id` | Fetch a reservation (lazy expiry applied) |
| `POST` | `/api/reservations/:id/confirm` | Confirm reservation — 410 if expired |
| `POST` | `/api/reservations/:id/release` | Release reservation early |
| `GET` | `/api/cron/expire` | Sweep stale reservations (called by Vercel Cron) |

### Idempotency (bonus)

Pass an `Idempotency-Key: <uuid>` header on `POST /api/reservations`. If the server has already processed a request with that key, it returns the original reservation without creating a duplicate or double-decrementing stock. The key is stored in the `Reservation.idempotencyKey` column with a unique constraint.

---

## Concurrency strategy

The reservation endpoint uses a **two-layer approach**:

### Layer 1 — Redis distributed lock

Before touching the database, we attempt to acquire a Redis lock keyed by `lock:{productId}:{warehouseId}` using `SET NX PX 5000` (set-if-not-exists, 5 s TTL). If the lock is already held (another request is mid-flight for the same SKU/warehouse), the request returns `429 Too Many Requests` so the caller can retry with a brief back-off.

The lock is released in a `finally` block using an atomic Lua script that only deletes the key if we still own the token — preventing a slow request from accidentally releasing a lock acquired by a subsequent request.

### Layer 2 — PostgreSQL row-level serialisation

Inside a Prisma `$transaction`, we:

1. Read the stock row for the requested product/warehouse.
2. Check `total - reserved >= quantity` in application code (fast path).
3. Update `reserved += quantity` only if the check passes.

Because Postgres serialises concurrent writes to the same row, two simultaneous requests for the last unit will be serialised at the DB level: one will read the post-increment `reserved` value and correctly fail the check.

The Redis lock is a performance optimisation — it avoids unnecessary DB round-trips under heavy concurrency. The Postgres check is the correctness guarantee.

---

## Reservation expiry

### Production: Vercel Cron + lazy cleanup

Two mechanisms ensure expired reservations are cleaned up:

**Vercel Cron** (`vercel.json`) triggers `GET /api/cron/expire` every minute. This endpoint calls `expireStaleReservations()` which finds all `PENDING` reservations past their `expiresAt` and releases each one (returning stock to the pool). The route is protected by a `CRON_SECRET` Bearer token set in Vercel environment variables.

**Lazy cleanup on read**: Whenever any endpoint fetches a reservation by ID (`GET /api/reservations/:id`, the server-side reservation page render, confirm, release), it calls `maybeExpire()` which checks `expiresAt` and immediately releases if elapsed. This means the stock is always correctly accounted for even between cron ticks.

### Why not a long-running background worker?

Vercel is serverless — there is no persistent process. A cron job is idiomatic and matches the platform. The lazy cleanup covers the gap between cron runs (worst case 60 s), which is acceptable for a 10-minute window.

---

## Trade-offs & things I'd do differently

**What's here:**
- Full CRUD API with correct status codes (201, 409, 410, 404)
- Race-condition-safe reservation using Redis lock + Postgres row serialisation
- Idempotency key support on the reserve endpoint
- Live countdown timer with automatic server-side expiry detection
- Lazy expiry + Vercel Cron sweep
- Seeded database with realistic demo data

**What I'd add with more time:**
- **Authentication**: reservations should be tied to a user session. Right now any client can confirm/release any reservation by ID.
- **Optimistic UI refresh on the product listing**: available stock counts are fetched at render time; a Suspense + revalidation pattern (or polling) would keep them live.
- **Retry logic on the frontend**: for 429 responses from the lock, the UI could auto-retry with exponential back-off rather than surfacing a raw error.
- **Observability**: structured logs and a metrics endpoint (reservations created/expired/confirmed per minute) for ops visibility.
- **Integration tests**: Jest + a test Postgres instance to verify the concurrency invariants programmatically (two concurrent requests, exactly one 409).
- **Multi-warehouse aggregation**: currently a reservation locks one warehouse. A smarter system could split an order across warehouses if a single one lacks sufficient stock.
