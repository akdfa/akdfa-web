# Releasing AKDFA (and keeping login working)

**Login works on any host.** Sessions are bearer tokens kept in the browser (no cookies), so
it doesn't matter where the site lives — it only needs to know where the API is.

## Recommended: one service (API serves the website)

One URL, no CORS, nothing to wire up. `SERVE_SITE=true` makes the API serve the pages too.

| Host | Notes |
|---|---|
| **Render** (easiest) | `render.yaml` in the repo root is a ready Blueprint: *New → Blueprint → pick the repo*. Free plan sleeps when idle — fine for testing |
| **Railway / Fly.io / any Docker host** | Build the root `Dockerfile` (context = repo root). Set the env vars below |
| **A VPS** (Hetzner, DigitalOcean, EC2) | `NODE_ENV=production SERVE_SITE=true node backend/src/server.js` behind nginx/Caddy for HTTPS |

The database stays on Supabase (already set up). Nothing else to host.

### Steps (Render)

**Already done for you:** a separate production schema (`akdfa_prod`) exists in the Supabase
database, migrated and seeded (districts, units, State admin — no demo data), encrypted with a
**fresh production key**. All the secrets are in `backend/.env.production.local` (git-ignored).
Don't reuse the dev `ENCRYPTION_KEY` — it was committed to the public repo, so treat it as public.

1. Render → **New → Blueprint** → connect `akdfa/akdfa-web` → choose branch **Dev** → it reads `render.yaml`.
2. Open the new service → **Environment → Add from .env** → paste the contents of
   `backend/.env.production.local` (DATABASE_URL, ENCRYPTION_KEY, JWT secrets, admin password).
3. Also set these three to the service's own URL (shown at the top of the page, e.g.
   `https://akdfa.onrender.com`): `PUBLIC_BASE_URL`, `SITE_BASE_URL`, `CORS_ORIGIN`.
4. Save → Render redeploys. On boot it runs `prisma migrate deploy` (no-op, already applied).
5. Open the URL → **Sign in** as `admin@akdfa.org` with `BOOTSTRAP_ADMIN_PASSWORD` from that file,
   then change the password under *Profile → Change password*.

Seeding is not needed on Render (the free plan has no shell) — it was done from the dev machine:
`NODE_ENV=production SEED_DEMO=off node prisma/seed.js` with the production env loaded.

The server refuses to start in production if `DATABASE_URL`, `ENCRYPTION_KEY` or the JWT
secrets are missing, so a mis-set config fails loudly instead of running insecurely.

## Alternative: website and API on separate hosts

Site on Netlify / Vercel / Cloudflare Pages / GitHub Pages; API on Render etc.

1. Edit **`js/config.js`** and set `window.AKDFA_API_BASE = "https://your-api.onrender.com";`
2. On the API set `CORS_ORIGIN=https://your-site.netlify.app` and `SITE_BASE_URL=` the same.
3. Make sure the static host **keeps query strings** when it rewrites `.html` URLs
   (`sponsor-pay.html?token=…`, `reset.html?token=…` depend on it).

## Before real users arrive

| | |
|---|---|
| **Uploads** | A container's disk is wiped on every deploy. Use `UPLOAD_DRIVER=s3` — Supabase Storage is S3-compatible (*Storage → S3 connection*: endpoint, region, keys). Use **two buckets**: a *public* one (`S3_BUCKET`) for photos/logos and a *private* one (`S3_PRIVATE_BUCKET`) for official documents |
| **Email** | `MAIL_DRIVER=smtp` + `SMTP_*`. Until then password-reset / welcome emails only print to the server log |
| **Payments** | `RAZORPAY_KEY_ID/SECRET` (test keys first), and point the Razorpay webhook at `https://<host>/api/v1/payments/webhook` with `RAZORPAY_WEBHOOK_SECRET` |
| **Reminders** | Schedule `node scripts/send-reminders.js` daily (Render *Cron Job*, or any cron) |
| **Secrets** | Change the seeded admin password after first login; never reuse the dev JWT secrets; rotate any password that was ever pasted into chat or a ticket |
| **Supabase** | Tables live in the `akdfa` schema (not `public`), so they are not exposed through Supabase's auto-generated REST API |
| **HTTPS** | Render/Railway/Fly give you HTTPS automatically; the server then sends HSTS and upgrades insecure requests |

## What was verified locally

Production mode (`NODE_ENV=production SERVE_SITE=true`) was run against the real database:
site + API on one port, login through the browser, the 18-step smoke suite, and a check
that `.env`, `backend/`, `docs/`, `.git` and path-traversal attempts all return 404 and that
password-reset links are **not** echoed in API responses. The Docker image itself has not been
built here (no Docker on this machine) — the first Render build is its first real test.
