# AKDFA Digital Future — Engineering Handoff

This package turns the "Growing AKDFA: Our Digital Future" roadmap (presented to the State Committee, July 2026) into something the dev team can build from. Start here.

## What's in this handoff

| Deliverable | Location |
|---|---|
| Database schema (source of truth) | [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) |
| Raw PostgreSQL DDL | [`database/SCHEMA.sql`](database/SCHEMA.sql) |
| ER diagrams (by phase + master) | [`database/ERD.md`](database/ERD.md) — shareable version: see the artifact link shared alongside this doc |
| Backend API (Express + Prisma, all phases scaffolded, Phase 1 fully wired) | [`backend/`](../backend/) |
| API reference | [`api/API_REFERENCE.md`](api/API_REFERENCE.md) |
| Architecture & tech-stack decisions | [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) |

## Quick start for a new engineer

```bash
cd backend
npm install
cp .env.example .env
# fill in DATABASE_URL (a free Postgres from Supabase/Neon/Railway works for local dev)
npx prisma migrate dev
npm run prisma:seed      # 14 districts + placeholder units
npm run dev               # API on http://localhost:4000/api/v1
```

The frontend is now wired to this API:
- Public forms (contact, sponsor lead, newsletter) submit for real; `join.html` is live registration and `login.html` opens the portal — see `js/api.js` + `js/public.js`.
- The member & Committee portal is `app.html` (`js/app.js`, `css/app.css`) — a hash-routed SPA covering Phases 2–5. `admin.html` now just redirects there. See `docs/FRONTEND.md`.

## How this maps to the roadmap

The schema was designed against **all five phases at once** so nothing gets rebuilt later — but the API and any frontend work should still ship in the roadmap's order:

1. **Phase 1** — auth, districts/units directory, events calendar, sponsors page, newsletter. The database and account system (this whole backend) is the "one-time investment" the roadmap describes; it's what makes every later phase possible.
2. **Phase 2** — member app: digital ID card, news feed, cricket hub, polls, badges/referrals, notification preferences.
3. **Phase 3** — District Committee dashboard: approve units/members, manage teams, log events/matches, local sponsor tracking.
4. **Phase 4** — State Committee dashboard: role management, district activity reports, broadcasts, documents, audit log.
5. **Phase 5** — Razorpay-backed membership fees and the AKDFA store.

Every backend module exists and has a frontend consuming it (see the phase-to-module table in `architecture/ARCHITECTURE.md` and `docs/FRONTEND.md`).

## Honest status: what's real vs. what's next

- **Code-complete for Phases 0–5**: schema + migration (`prisma/migrations/`), every route with Prisma-backed logic, local file uploads, a seed that creates the 14 districts / 17 units / bootstrap State Committee account / starter badges + products + news + events, and a full frontend (public site + `app.html` portal).
- **Not yet run against a live Postgres in this environment** — no working `DATABASE_URL` was available. First task on a real machine: set `DATABASE_URL` in `backend/.env`, `npm run setup`, `npm run dev`, then `npm run smoke`.
- **Needs product decisions before launch**: the real unit names/contacts beyond one-per-district (`prisma/seed.js`), the approved annual membership fee (`MEMBERSHIP_FEE_INR`), an S3 bucket if uploads must survive redeploys, and an email/SMS/push provider for notification delivery (`Notification` rows are created; nothing sends them).
- **Not done (out of scope / no hosting)**: deployment, CI, and any live infrastructure.
