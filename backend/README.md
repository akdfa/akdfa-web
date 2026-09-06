# AKDFA Backend

REST API for the AKDFA member platform — auth, membership, districts/units, news & events, the cricket hub, sponsors, badges/referrals, notifications, district reporting, payments, and the AKDFA store. Built to match the phased roadmap in [`docs/architecture/ARCHITECTURE.md`](../docs/architecture/ARCHITECTURE.md).

## Stack

- **Node.js + Express** — REST API
- **PostgreSQL + Prisma** — database & ORM (`prisma/schema.prisma` is the source of truth)
- **JWT (access + rotating refresh tokens)** — auth
- **Razorpay** — payments (Phase 5; optional until keys are configured)
- **Zod** — request validation

## Getting started

```bash
cd backend
npm install
cp .env.example .env        # fill in DATABASE_URL at minimum
npx prisma migrate dev      # creates the database and applies the schema
npm run prisma:seed         # seeds the 14 districts + placeholder units
npm run dev                 # starts the API on http://localhost:4000
```

Health check: `GET /health`. All API routes are mounted under `/api/v1`.

## Project layout

```
backend/
  prisma/
    schema.prisma      # the entire data model (see docs/database/ERD.md for the diagram)
    seed.js             # seeds districts + units
  src/
    app.js               # express app: middleware, routes, error handling
    server.js            # entrypoint
    config/              # env, prisma client, razorpay client
    middleware/           # auth, role checks, validation, error handler
    utils/                 # jwt, password hashing, ApiError, asyncHandler
    modules/                # one folder per domain, each owns its routes
      auth/                  # register, login, refresh, logout, me
      districts/ units/        # org structure
      members/                  # directory, approval, roles, digital card
      news/ events/ polls/        # Phase 1/2 content & engagement
      cricket/                     # teams, players, matches, trials (Phase 2/3)
      sponsors/                     # public sponsors + district sponsorship logs
      growth/                        # badges + referrals (Phase 2)
      notifications/                  # per-member feed, preferences, state broadcasts
      reports/                         # district monthly reports, state overview (Phase 4)
      admin/                             # documents + audit log (Phase 4)
      payments/                           # membership fees + sponsor payments (Phase 5)
      store/                               # products + orders (Phase 5)
      public/                               # newsletter signup, contact form
    routes/index.js    # mounts every module under /api/v1
```

## Auth model

- Roles, low to high: `MEMBER` → `UNIT_ADMIN` → `DISTRICT_ADMIN` → `STATE_ADMIN`. `requireRole(X)` middleware passes for `X` and anything above it.
- New registrations land as `PENDING` and need a `UNIT_ADMIN`+ to approve them (`POST /members/:id/approve`) before they're `ACTIVE`.
- Access tokens are short-lived (15m default); refresh tokens are stored **hashed** and rotated on every use — a stolen refresh token only works once before the swap invalidates it.
- Every state/district-admin action that changes approval status or role should call `logAudit(...)` from `modules/admin/audit.service.js` (Phase 4's "who changed what and when").

## What's implemented

Every route has real Prisma-backed logic and the frontend (`../app.html`, `../js/`) consumes it.

- **Auth** — register (with optional `referrerId`), login, rotating refresh, logout, `me`.
- **Members** — directory (role-scoped), approval, role changes, digital card, `/members/me/dashboard` aggregate.
- **Districts / units** — public directory, unit proposal + approval, `?status=ALL` for admins.
- **News / events / polls** — publish, feed, RSVP, vote (one per poll, changeable).
- **Cricket** — teams, rosters, matches (+ single match), results with per-player stats, predictions, trials, trial applications.
- **Sponsors** — public list, `?scope=all` for admins, leads, district sponsorship ledger.
- **Growth** — badges, awards, referrals (auto-JOINED on member approval).
- **Notifications** — feed, read, per-category/channel preferences, State broadcasts.
- **Reports** — monthly district report upsert, state overview.
- **Admin** — document library, audit log.
- **Payments / store** — Razorpay order creation, `POST /payments/verify` (browser confirmation),
  HMAC-verified webhook, membership fees, store catalogue + orders + fulfilment tracking.
- **Uploads** — `POST /api/v1/uploads` (multipart `file`) → `{ url }`, stored on local disk under
  `uploads/` and served from `/uploads`. Swap the driver for S3 in production.

### Still needs a real decision before production

- Confirmed annual membership fee (`MEMBERSHIP_FEE_INR`, default ₹500).
- Real unit names/contacts beyond the one-per-district seed (`prisma/seed.js`).
- An email/SMS/push provider — `Notification` rows are created but nothing delivers them.
- An S3-compatible bucket if uploads need to survive redeploys.

## Setup

```bash
npm install
cp .env.example .env      # set DATABASE_URL
npm run setup             # migrate deploy + generate + seed
npm run dev
npm run smoke             # optional end-to-end check
```
