# Release guide: Dev to production

The repo has two long-lived branches: **`Dev`** (testing, dev schema `akdfa`) and **`main`** (production, schema `akdfa_prod`). There is no `master` branch; `main` is the one to release from.

The app is one Node service (the `Dockerfile` at the repo root) that serves both the API and the website. It runs on any host that can run a Docker container or a Node 20 process and reach the Postgres database: Railway, Fly.io, a VPS, Kubernetes, and so on. This guide does not assume one host. Wherever it says "your host", use that host's own environment-variable settings and deploy trigger.

## 1. Before you merge (on `Dev`)

- [ ] `cd backend && npm test` passes (53 tests).
- [ ] With the API running locally: `node scripts/e2e.js` and `node scripts/smoke.js` pass.
- [ ] Open the site and the member app and click through: home, units, updates, gallery, sponsors, join, login, and the State admin screens.
- [ ] The working tree is clean (`git status`). Uploaded test files in `uploads/` and `private/` are not source and are never committed.
- [ ] New database tables or columns have a folder in `backend/prisma/migrations/` (for example `20261023000000_social_links`). They are applied on release with `cd backend && npm run prisma:deploy` (`prisma migrate deploy`). Run it as a release step, or as the container's start command, on whatever host you use.

## 2. Files that change for a release

| File | Change | Why |
|---|---|---|
| Deploy config for your host (for example `fly.toml` or a compose file) | Point it at the `main` branch or the production image, and pick an always-on plan | The repo no longer ships a host-specific config. |
| `js/config.js` | Normally nothing | Leave `AKDFA_API_BASE` commented out while the API serves the site (one service, one URL). Set it only if the site is hosted separately from the API. |
| Asset and CSS versions (`style.css?v=`, `js/app.js?v=`, `css/pages.css?v=`) | Bump the number on any file you changed | Browsers cache these for an hour, so users would otherwise see old files. |
| `backend/.env.production` | Normally nothing | It is only a template with empty secrets. Never put real values in it. |
| `docs/FEATURES.md`, `docs/api/API_REFERENCE.md` | Update if features or routes changed | Keeps the docs true. |

Do not commit `backend/.env.development.local`, any `.env*.local` file, or the `uploads/` and `private/` folders.

## 3. Merging `Dev` into `main`

```bash
git checkout Dev
git pull origin Dev
git checkout main
git pull origin main
git merge Dev            # or open a pull request Dev -> main on GitHub and merge it there
git push origin main
```

A pull request is better: CI (`.github/workflows/ci.yml`) runs the tests on it before anything reaches production. After the merge, switch back with `git checkout Dev` and keep working there.

## 4. Settings to define on your host (production)

Set these as environment variables on your host (or in `backend/.env.production.local` on a server, which is git-ignored). Production must use **production** values, never the dev ones.

| Key | Production value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | Postgres string ending `?schema=akdfa_prod&sslmode=require&connection_limit=8&pool_timeout=30` | `akdfa_prod`, not `akdfa`. The `connection_limit` and `pool_timeout` stop connection errors under load with a pooled database. |
| `ENCRYPTION_KEY` | 64 hex characters | Generate once with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Never change it after real data exists.** Member names, emails and phones are encrypted with it; losing or changing it makes them unreadable. Use a different key from dev. |
| `JWT_ACCESS_SECRET` | long random string | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | a different long random string | Changing either later signs everyone out. |
| `PUBLIC_BASE_URL` | `https://<your-domain>` | Used for upload and receipt links. |
| `SITE_BASE_URL` | the same URL | Used for password-reset and verify links. |
| `CORS_ORIGIN` | the same URL, not `*` | |
| `SERVE_SITE` | `true` | The API also serves the website. |
| `TRUST_PROXY` | `1` | Set when the app sits behind a load balancer or reverse proxy. |
| `PORT` | the port your host expects (default `4000`) | |
| `BOOTSTRAP_ADMIN_EMAIL` | the real State Committee email | |
| `BOOTSTRAP_ADMIN_PASSWORD` | a strong new password | Not the dev default. Change it again after the first login. |
| `MEMBERSHIP_FEE_INR` | the approved annual fee | |

Optional integrations (features stay off until set):

| Keys | Turns on |
|---|---|
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Fee, store and sponsor payments. Use **live** keys in production and add the webhook URL in the Razorpay dashboard. |
| `MAIL_DRIVER=resend`, `RESEND_API_KEY`, `MAIL_FROM` (or `MAIL_DRIVER=smtp` with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) | Real emails (welcome, password reset). With `log`, emails only print to the server log. Use a verified sending domain. |
| `UPLOAD_DRIVER=s3`, `S3_BUCKET`, `S3_PRIVATE_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` | Keeps uploaded photos and documents. Any S3-compatible store works (AWS S3, Cloudflare R2, MinIO, Supabase Storage). If your host's disk is not persistent, you need this; with `local` uploads are stored in `UPLOAD_DIR` and are lost when the disk is wiped. |

The server refuses to start in production without `ENCRYPTION_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `DATABASE_URL`.

## 5. Running it

Pick whichever fits your host:

```bash
# Docker (from the repo root)
docker build -t akdfa .
docker run -p 4000:4000 --env-file production.env akdfa

# Plain Node on a server
cd backend && npm ci --omit=dev
npm run prisma:deploy     # apply migrations
NODE_ENV=production npm start
```

Put it behind HTTPS (your host's load balancer, or a reverse proxy such as nginx or Caddy). Use `/health` as the health-check path.

## 6. First release only: create the production data

The first start against `akdfa_prod` runs the migrations on an empty schema. Then create the first State Committee account (it uses the `BOOTSTRAP_ADMIN_*` values):

```bash
cd backend
node prisma/seed.js      # run only against akdfa_prod, with the production DATABASE_URL and ENCRYPTION_KEY
```

The seed also adds the districts and units. Check what it adds before running it against production, and do not run it again against a schema that already has real members.

## 7. After the deploy

- [ ] `https://<your-domain>/health` returns OK.
- [ ] The home page loads with styles.
- [ ] Sign in as the State admin, then change the bootstrap password.
- [ ] Add the real content in the app: units, news, events, sponsors, social media. Nothing is added automatically.
- [ ] Join with a test account and approve it, to confirm the emails and approval flow work.
- [ ] Rollback if something is wrong: redeploy the previous image or release on your host, or `git revert` the merge commit and push `main`. Migrations are not undone automatically, so keep them backward compatible.

## Secrets rules

- Never commit real keys. The dev key was committed once and must be treated as public; production uses a new one.
- Rotate the database password if it was ever shared in chat or a screenshot.
- Keep `akdfa` (dev) and `akdfa_prod` (production) apart: never point a local or test run at `akdfa_prod`.
