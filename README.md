# AKDFA — Website + Member Platform

Full implementation of the "Growing AKDFA: Our Digital Future" roadmap (Phases 0–5) and the
companion "AKDFA Database Overview".

| Layer | Where | Stack |
|---|---|---|
| Public website | repo root (`index.html`, `about.html`, …) | static HTML/CSS/JS |
| Member & Committee portal | `app.html` + `js/app.js` + `css/app.css` | vanilla SPA (hash router) |
| Shared API client | `js/api.js` | fetch + JWT refresh |
| Backend API | `backend/` | Node + Express + Prisma |
| Database | PostgreSQL | schema in `backend/prisma/schema.prisma` |

## What's built

- **Phase 0/1 — public site + accounts:** every public form is live (contact, sponsor lead,
  newsletter). `join.html` is real membership registration (district → unit → password);
  `login.html` signs in and opens the portal.
- **Phase 2 — member app** (`app.html`): digital membership card, unified news feed, events
  calendar with RSVP, polls, cricket hub (teams/rosters/fixtures/results/trials + predictions +
  trial applications), badges, referral link, notification preferences.
- **Phase 3 — District Committee tools:** approve members, register/approve units, manage teams
  & matches & trials, publish news/events/polls, add sponsors, keep a local sponsorship ledger,
  submit the monthly district report, upload documents.
- **Phase 4 — State Committee tools:** state overview dashboard, role management, full audit
  trail, broadcasts to every district or one, document library.
- **Phase 5 — payments & store:** Razorpay-backed membership fees and the AKDFA store
  (cart → order → checkout), member pricing, order tracking, store product management.

## Public site is data-driven

The marketing pages read live data through `js/public-content.js`: `units.html` shows each
district "brought to life" (story, events, results, charity impact via
`GET /districts/:id/showcase`), `news.html` renders the live news feed + events calendar,
`sponsors.html` lists real sponsors. Pages fall back to their static content if the API is
unreachable. Sponsors pay via `sponsor-pay.html?token=…` (no login) and get an invoice.

> If you serve the site with a host that rewrites `.html` URLs, make sure it **preserves
> query strings** so `sponsor-pay.html?token=…` works.

## Run it locally

### 1. Database + API

```bash
cd backend
npm install
# .env.development is committed with working local defaults. If your Postgres
# password isn't "postgres", create backend/.env with:
#   DATABASE_URL="postgresql://postgres:YOURPASS@localhost:5432/akdfa_dev?schema=public"
npm run setup                  # migrate + generate + seed (districts, units, admin, demo data)
npm run dev                    # API on http://localhost:4000
```

Environment files load in order `.env.<NODE_ENV>.local` → `.env.local` → `.env.<NODE_ENV>` → `.env`
(first wins; host env beats all). For live: fill `backend/.env.production` (or the host's env) and
run `NODE_ENV=production npm start` — it refuses to boot without the required secrets.

`npm run setup` prints the bootstrap **State Committee** login (default
`admin@akdfa.org` / `akdfa-admin-2026` — change via `.env`).

### 2. The site

Serve the repo root with any static server so the pages can reach the API:

```bash
npx serve -l 5500 .
```

Open `http://localhost:5500/`. The portal lives at `/app.html` (or click **Sign In**).
The API base auto-resolves to `:4000` on the current host; override per device with
`localStorage.setItem("akdfa.apiBase", "https://api.example.org")`.

### 3. Smoke test (optional)

```bash
cd backend && npm run smoke
```

## Data encryption

PII (email, phone, date of birth, addresses, contact details, private notes, document
URLs, contact-form messages) is encrypted at rest with **AES-256-GCM** before it reaches
Postgres — a Prisma middleware handles it transparently. `email`/`phone` stay searchable via
a keyed blind-index hash. Set `ENCRYPTION_KEY` (32 bytes hex) in `backend/.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never change the key once real data exists. For a database that already holds plaintext:
`node backend/scripts/encrypt-backfill.js`. Details in `docs/architecture/ARCHITECTURE.md`.

## Integrations (all optional — sensible defaults out of the box)

| What | Default | Production |
|---|---|---|
| **Payments** | off (checkout → 503) | set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (+ `RAZORPAY_WEBHOOK_SECRET` for the dashboard webhook) |
| **File storage** | `UPLOAD_DRIVER=local` (disk) | `UPLOAD_DRIVER=s3` + `S3_BUCKET` / `S3_REGION` / keys — works with AWS S3, Cloudflare R2, MinIO |
| **Email** | `MAIL_DRIVER=log` (prints) | `MAIL_DRIVER=smtp` + `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` |
| **Renewal reminders** | manual | schedule `npm run reminders` daily (cron / Task Scheduler) |

The S3 and SMTP SDKs are `optionalDependencies`, loaded only when their driver is selected.

## Tests & CI

```bash
cd backend && npm test          # unit tests (crypto, access rules, notify, receipts) — no DB
cd backend && npm run smoke     # end-to-end against a running API + seeded DB
```

`.github/workflows/ci.yml` runs the syntax checks, unit tests, and a full migrate → seed →
smoke pass against a Postgres service on every push / PR.

## Docs

- `docs/HANDOFF_README.md` — engineering handoff
- `docs/api/API_REFERENCE.md` — endpoint map
- `docs/architecture/ARCHITECTURE.md` — stack decisions
- `docs/database/ERD.md` / `SCHEMA.sql` — data model
- `docs/FRONTEND.md` — portal structure and how to extend it
