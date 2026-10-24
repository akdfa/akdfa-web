# Releasing AKDFA (and keeping login working)

**Login works on any host.** Sessions are bearer tokens kept in the browser (no cookies), so
it doesn't matter where the site lives — it only needs to know where the API is.

## Recommended: one service (API serves the website)

One URL, no CORS, nothing to wire up. `SERVE_SITE=true` makes the API serve the pages too.

| Host | Notes |
|---|---|
| **Any Docker host** (Railway, Fly.io, Kubernetes, a container service) | Build the root `Dockerfile` (context = repo root). Set the env vars listed in `docs/RELEASE.md` |
| **A VPS** (Hetzner, DigitalOcean, EC2) | `NODE_ENV=production SERVE_SITE=true node backend/src/server.js` behind nginx/Caddy for HTTPS |

The database stays on Supabase (already set up). Nothing else to host.

### Steps (any host)

The full step-by-step release checklist, the files to change and every key to set are in
[`docs/RELEASE.md`](RELEASE.md). In short:

1. Build and run the Dockerfile (or run Node directly) on your host.
2. Set the production environment variables (database URL, `ENCRYPTION_KEY`, JWT secrets, the three site URLs, admin password).
3. Run `npm run prisma:deploy` in `backend/` to apply migrations (or let your start command do it).
4. Open the URL, sign in as the State admin and change the bootstrap password.

The server refuses to start in production if `DATABASE_URL`, `ENCRYPTION_KEY` or the JWT
secrets are missing, so a mis-set config fails loudly instead of running insecurely.

## Alternative: website and API on separate hosts

Site on Netlify / Vercel / Cloudflare Pages / GitHub Pages; API on any Node/Docker host.

1. Edit **`js/config.js`** and set `window.AKDFA_API_BASE = "https://your-api.example.com";`
2. On the API set `CORS_ORIGIN=https://your-site.netlify.app` and `SITE_BASE_URL=` the same.
3. Make sure the static host **keeps query strings** when it rewrites `.html` URLs
   (`sponsor-pay.html?token=…`, `reset.html?token=…` depend on it).

## Before real users arrive

| | |
|---|---|
| **Uploads** | A container's disk is wiped on every deploy. Use `UPLOAD_DRIVER=s3` — Supabase Storage is S3-compatible (*Storage → S3 connection*: endpoint, region, keys). Use **two buckets**: a *public* one (`S3_BUCKET`) for photos/logos and a *private* one (`S3_PRIVATE_BUCKET`) for official documents |
| **Email** | `MAIL_DRIVER=smtp` + `SMTP_*`. Until then password-reset / welcome emails only print to the server log |
| **Payments** | `RAZORPAY_KEY_ID/SECRET` (test keys first), and point the Razorpay webhook at `https://<host>/api/v1/payments/webhook` with `RAZORPAY_WEBHOOK_SECRET` |
| **Reminders** | Schedule `node scripts/send-reminders.js` daily (your host's cron/scheduled job, or any cron) |
| **Secrets** | Change the seeded admin password after first login; never reuse the dev JWT secrets; rotate any password that was ever pasted into chat or a ticket |
| **Supabase** | Tables live in the `akdfa` schema (not `public`), so they are not exposed through Supabase's auto-generated REST API |
| **HTTPS** | Most managed hosts give you HTTPS automatically; the server then sends HSTS and upgrades insecure requests |

## What was verified locally

Production mode (`NODE_ENV=production SERVE_SITE=true`) was run against the real database:
site + API on one port, login through the browser, the 18-step smoke suite, and a check
that `.env`, `backend/`, `docs/`, `.git` and path-traversal attempts all return 404 and that
password-reset links are **not** echoed in API responses. The Docker image itself has not been
built here (no Docker on this machine) — the first Docker build on your host is its first real test.
