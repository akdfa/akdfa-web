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

## Run it locally

### 1. Database + API

```bash
cd backend
npm install
cp .env.example .env          # then set DATABASE_URL to your local Postgres
npm run setup                  # migrate + generate + seed (14 districts, 17 units, admin, demo data)
npm run dev                    # API on http://localhost:4000
```

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

## Payments

Set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in `backend/.env` to enable checkout. The browser
checkout handler verifies each payment via `POST /payments/verify`; configure the dashboard
webhook (`/payments/webhook`, `RAZORPAY_WEBHOOK_SECRET`) for production.

## Docs

- `docs/HANDOFF_README.md` — engineering handoff
- `docs/api/API_REFERENCE.md` — endpoint map
- `docs/architecture/ARCHITECTURE.md` — stack decisions
- `docs/database/ERD.md` / `SCHEMA.sql` — data model
- `docs/FRONTEND.md` — portal structure and how to extend it
