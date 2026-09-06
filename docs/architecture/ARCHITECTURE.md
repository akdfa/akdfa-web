# AKDFA — Backend Architecture

Companion to the "Growing AKDFA: Our Digital Future" roadmap presented to the State Committee. This doc covers the technical decisions behind Phase 1's "invisible but essential" system and how it scales through Phase 5.

## Why this stack

| Layer | Choice | Why |
|---|---|---|
| API | Node.js + Express | Small, well-understood surface area; the existing site is already JS-based (`script.js`), so the team doesn't context-switch languages |
| Database | PostgreSQL | Relational data (districts → units → members → teams) with real foreign-key integrity; free-tier hosting available (Supabase, Railway, Neon) |
| ORM | Prisma | Schema file doubles as documentation and the ERD source; generates type-safe queries and migrations from one file |
| Auth | JWT access token + rotating refresh token | Stateless access checks, no server-side session store to run; refresh tokens are stored **hashed** and rotated so a leaked token is single-use |
| Payments | Razorpay | Already trusted by associations across India (UPI, cards, net banking) — matches Phase 5's requirement directly |
| Hosting target | Any Node host (Render, Railway, Fly.io) + managed Postgres | AKDFA is a volunteer-run association, not a company with dedicated infra staff — pick platforms with generous free/cheap tiers and no ops burden |

This is intentionally a monolith, not microservices. At AKDFA's scale (17 units, thousands of members at most), one deployable API is easier for a small or volunteer dev team to run, debug, and reason about than a distributed system.

## How the phases map to the codebase

The roadmap's phases aren't separate systems — they're the same schema and API, built incrementally. Every model for every phase already exists in `backend/prisma/schema.prisma` so later phases don't require breaking migrations.

| Phase | What ships | Backend modules |
|---|---|---|
| 0 (done) | Static site | — |
| 1 | Public site + accounts | `auth`, `districts`, `units`, `news` (public), `events` (calendar), `sponsors` (public + leads), `public` (newsletter/contact) — **this is where the database and auth system get built**, everything after depends on it |
| 2 | Member app | `members` (card), `news` (feed), `cricket` (roster/trials), `polls`, `growth` (badges/referrals), `notifications` (preferences) |
| 3 | District Committee tools | `units` (approve), `members` (approve), `cricket` (teams/matches), `events` (create), `sponsors` (local logs), `notifications` (district-scoped) |
| 4 | State Committee tools | `members` (roles), `reports`, `notifications` (broadcast), `admin` (documents, audit log) |
| 5 | Payments & store | `payments`, `store` |

## Data model

See [`../database/ERD.md`](../database/ERD.md) for the diagrams and [`../database/SCHEMA.sql`](../database/SCHEMA.sql) for the raw DDL. Three modeling decisions worth flagging for the team:

- **`Member.districtId` is denormalized** (also derivable via `Member.unit.districtId`) purely so district-scoped queries (Phase 4 oversight) don't need a join on every request.
- **Role is a single enum on `Member`**, not a separate permissions table. Phase 4 asks for "decide who is allowed to approve what" — the four-tier hierarchy (`MEMBER < UNIT_ADMIN < DISTRICT_ADMIN < STATE_ADMIN`) covers everything in the roadmap. If a future need arises for finer-grained permissions (e.g. a treasurer role that can't approve members), add a `Permission`/`RolePermission` table then — don't build it speculatively now.
- **`AuditLog` is generic** (`entityType` + `entityId` + `metadata` JSON) rather than one log table per entity, so any future admin action can be audited without a schema change.

## Data-at-rest encryption

PII is encrypted at the application layer before it reaches Postgres, so a leaked
dump / stolen disk / over-broad `SELECT` yields ciphertext, not member data.

- **Cipher:** AES-256-GCM, random 96-bit IV per value, authenticated. Stored as
  `v1:<iv>:<tag>:<ciphertext>` (all base64). Key from `ENCRYPTION_KEY` (32 bytes hex).
- **Where:** a Prisma `$use` middleware (`src/config/prisma.js`) encrypts on
  write and decrypts on read (recursively through `include`d relations), driven by
  `src/utils/crypto.js`. Encrypted fields: `Member.email/phone/dateOfBirth`,
  `Unit.address/contactEmail/contactPhone`, `Sponsor.contact*`,
  `SponsorshipLog.sponsorName/notes`, `Document.fileUrl`,
  `NewsletterSubscriber.email`, `ContactMessage.email/phone/message`.
- **Lookups:** `email` and `phone` are unique and must be searchable, so a keyed
  HMAC "blind index" is stored alongside (`emailHash`, `phoneHash`). Login,
  registration and newsletter upserts query the hash, never the plaintext.
- **Not encrypted (by design):** names (directory sort), `memberNumber`, roles,
  district/unit names, timestamps, foreign keys, money amounts (needed for
  `SUM()` in the State overview), and `gatewayRef` (payment-provider order ids).
- **Passwords** stay `bcryptjs`; **refresh tokens** stay SHA-256 hashed.
- **Key management:** `ENCRYPTION_KEY` lives in `.env` only. Rotating it orphans
  existing ciphertext — a rotation needs a decrypt-with-old / re-encrypt-with-new
  pass (same shape as `scripts/encrypt-backfill.js`). Losing it = losing the data.
- Pair this with database/volume-level encryption on the host for defence in depth.

### Official documents

Bylaws / minutes / circulars are the one place the site stores genuinely
confidential files, so they get stricter handling than other uploads:

- Files land in `backend/private/documents/` — **not** under the
  `express.static("/uploads")` mount, so there is no public URL for them.
- Every download goes through `GET /admin/documents/:id/file` (or the public
  route for `PUBLIC` docs), which re-runs the visibility check
  (`src/modules/admin/documents.access.js`) before streaming a byte.
- `fileKey` (the on-disk name) is encrypted at rest and never leaves the server.
- `visibility` is `PUBLIC` (website), `DISTRICT_ONLY` (that district's members +
  admins + State), or `STATE_ONLY` (State Committee only). District admins can
  only see / edit / delete documents in their own district.
- Upload, edit and delete write `DOCUMENT_*` entries to the audit log.

## Security notes for the team

- Passwords: `bcryptjs`, 12 salt rounds. Never log or return `passwordHash`.
- Refresh tokens: stored as a SHA-256 hash, rotated on every `/auth/refresh` call, revocable by member.
- Every mutating admin endpoint checks role **and** scope (a `DISTRICT_ADMIN` can only touch their own district) — see `members.routes.js` for the pattern to copy elsewhere.
- Razorpay webhook signature is verified with HMAC before trusting any payload (`payments.routes.js`).
- Rate limiting is on globally, tighter on `/auth/*` to slow credential stuffing.
- Nothing here handles GDPR/data-export requests — not required for an Indian regional association, but worth a line in the bylaws doc if members ask.

## What's deliberately deferred

- **File storage** — profile photos, document PDFs, product images are stored as URLs; the actual upload pipeline (S3-compatible bucket + `multer`) is stubbed in `.env.example` but not wired, since bucket choice depends on hosting decisions the Committee hasn't made yet.
- **Notification delivery** — `Notification` rows are created in the DB; no email/SMS/push provider is connected. Recommend SES or MSG91 (India-focused, cheap SMS) when Phase 2 ships for real.
- **Match live-scoring** — `Match`/`PlayerMatchStat` support final scorecards, not ball-by-ball live updates. If live scoring becomes a real ask, that's a websocket layer on top of the existing `Match` model, not a schema change.

## Environments

Recommend three: `local` (developer machines, seeded data), `staging` (Committee preview before each phase ships), `production`. Same `DATABASE_URL`-driven config for all three — see `backend/.env.example`.
