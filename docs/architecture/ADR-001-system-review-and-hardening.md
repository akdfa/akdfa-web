# ADR-001: System review findings and hardening plan

**Status:** Accepted (item 2 implemented; the rest proposed)
**Date:** 2026-10-17
**Deciders:** State Committee (product owner), whoever maintains the API

## Context

AKDFA is one Node/Express service (`backend/`) with Prisma on Supabase Postgres. It serves a static
site (`*.html`, `css/`, `js/`) and a member/committee portal (`app.html`, `js/app.js`). Render builds the
root `Dockerfile` and runs it as a single service (`SERVE_SITE=true`).

This review traced the flows below by reading the code and probing a running API (dev schema `akdfa`,
read-only requests, plus two no-op writes that changed nothing):

public browse (home, units, news, events, gallery, sponsors, contact) → self-register → admin approval →
login / refresh / logout / password reset → member app (card, profile, events, polls, store, fees) →
committee actions (members, units, content, sponsors, payments, reports) → deploy.

**What is already solid:** Helmet and rate limits are on; every body is validated with zod; queries go
through Prisma (no string-built SQL); refresh tokens are stored hashed and revoked on password reset;
roles have a clear hierarchy; PII is encrypted at rest with blind indexes for lookup; the static allowlist
keeps `backend/`, `.env` and `docs/` unreachable; admin changes are audit-logged; 26 unit tests pass.

## Findings

Severity: **High** = fix before real users. **Med** = fix soon. **Low** = tidy up.

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| 1 | High | **Deploy blocker (fixed in working tree):** the `Dockerfile` never copied `css/`, so on Render the homepage, inner pages and the whole member portal load with no stylesheets. | Pages reference `css/app.css`, `css/portal.css`, `css/pages.css`; the image only copied `js/` and `assets/`. |
| 2 | High | **FIXED in the working tree: no district/unit scoping on most write routes (broken object-level authorization).** `requireRole` only checks the *level*, so a district or unit admin can change another district's data. Modules with **no** scope checks: events, polls, cricket (teams, players, matches, trials), sponsors, store orders, growth (badges, referral rewards), units approve/reject, news delete. `GET /members/:id` and `PATCH /members/:id` also skip scope, while the list endpoint is scoped, so the rules are inconsistent. | **Live:** a district admin's `PATCH` on another district's event returned **200**, and `GET /members/<other-district member>` returned **200** (the list correctly showed only their own 30). |
| 3 | High | **Token theft is one missed escape away.** Access and refresh tokens live in `localStorage`, the CSP allows `script-src 'unsafe-inline'`, and `js/app.js` builds HTML with template strings. One un-escaped field (feedback, news, poll text) becomes stored XSS that can take over a State admin session. | `app.js` is about 2,000 lines of `innerHTML`; the site CSP in `app.js` of the API allows inline scripts. |
| 4 | Med | **Stale authority after changes.** Role, district and unit are baked into the 15-minute access token and never re-read. A demoted, suspended or password-reset user keeps working for up to 15 minutes. | `requireAuth` trusts the JWT only. Observed: after an admin reset, the old access token still returned 200 on `/auth/me`. |
| 5 | Med | **Encryption fails open and cannot rotate.** `decrypt` returns the raw ciphertext when the key is wrong, so admins see `v1:AL…` strings (seen in the Feedback inbox). `encrypt` skips any value that starts with `v1:`, so user input can bypass encryption. The same key also drives the blind index, login lookup and card tokens, and there is no key id in the ciphertext, so rotation would orphan everything. | `src/utils/crypto.js`. The dev key was committed earlier, so treat it as public. |
| 6 | Med | **Member numbers use `count() + 1`.** Two signups at once, or any deleted member, can produce a duplicate and `409 Duplicate value for memberNumber`. Right now numbers 1 to 70 are contiguous, so it works by luck. | `auth.routes.js` `nextMemberNumber`; `members.routes.js` retries but `/register` does not. |
| 7 | Med | **Dev and production share one Supabase project and one DB role.** Schemas `akdfa` and `akdfa_prod` sit in the same database and use the same pooler and `postgres` user, so a dev mistake or load test can hit production. The stress test produced HTTP 500s (`P1001`) at 40 users because Prisma opened more connections than the session pooler allows. | Fixed locally with `connection_limit=8&pool_timeout=30`; not yet in `render.yaml` or the deploy doc. |
| 8 | Med | **Abuse controls are thin.** Rate limits are in memory, per IP and per process. There is no per-account lockout, and a shared network (one district meeting, one mobile carrier) can lock out real members. Anyone can trigger admin notifications by registering, and `/contact` and `/newsletter` have no bot check. `register` also accepts unapproved or rejected units. | `app.js` limiters; `/register` looks the unit up without checking `status`. |
| 9 | Med | **Uploads trust the client's `Content-Type`** (no magic-byte check) and have no per-user quota. On Render the local disk is wiped each deploy, so photos disappear unless `UPLOAD_DRIVER=s3`. | `middleware/upload.js`; deploy doc already warns about the disk. |
| 10 | Low | **Production safety nets missing.** The seeded admin password has a known default (`akdfa-admin-2026`) and is not required in production. `CORS_ORIGIN` defaults to `*`. The Razorpay signature uses `!==` (not constant time). No error tracking, metrics or structured logs. | `config/env.js`, `payments.routes.js`. |
| 11 | Low | **Data hygiene in dev.** The public News list shows machine-made posts ("Dist news 1792…"), there are 11 rejected test units, and some older rows cannot be decrypted with the current key. | Visible on the homepage news cards and Feedback inbox. |
| 12 | Low | **Tests don't cover authorization.** CI runs unit tests plus smoke/e2e against Postgres, but nothing asserts "a district admin cannot touch another district". That is why #2 shipped. | `backend/test/`, `.github/workflows/ci.yml`. |

## Decision

Adopt a hardening plan in this order, as separate small PRs:

1. **Ship the Docker fix and push** (#1). Also push the `uploads` route (it was missing from git), or the first Render build fails at boot.
2. **One central scope check** (#2): `assertCanManage(req.auth, { districtId, unitId })` in `src/middleware/scope.js` (State anywhere; district admin inside their district; unit admin inside their unit). Load the target row first, call the helper, then mutate. Apply it to every module in the table above and to `GET/PATCH /members/:id`. Add an authorization test for each.
3. **Fix `count() + 1`** (#6) with a Postgres sequence, and reject unapproved units at `/register` (#8).
4. **Harden the browser side** (#3): move inline scripts out so the CSP can drop `'unsafe-inline'`, audit every `innerHTML` for `esc()`, and consider an httpOnly cookie for the refresh token.
5. **Make tokens revocable** (#4): add a `tokenVersion` (or `passwordChangedAt`) checked against a short in-memory cache, or cut the access TTL to about 5 minutes.
6. **Crypto v2** (#5): put a key id in the ciphertext, use a separate HMAC key for blind indexes, fail closed (log and alert) on decrypt errors, and stop skipping `v1:` input.
7. **Separate environments** (#7): a second Supabase project for dev, or at minimum separate DB roles with schema-only grants. Put `connection_limit` and `pool_timeout` in the production `DATABASE_URL` guidance.
8. **Production guards** (#10): refuse to start without `BOOTSTRAP_ADMIN_PASSWORD` or a non-`*` `CORS_ORIGIN`; use `crypto.timingSafeEqual` for the webhook.

## Options considered

### A: Central scope helper plus tests (chosen for #2)
| Dimension | Assessment |
|---|---|
| Complexity | Low to medium: one file, about 20 handlers touched |
| Cost | A day or two, plus tests |
| Risk | Low: only adds denials |

**Pros:** closes the whole class at once, easy to review, easy to test. **Cons:** each handler needs the target row's `districtId`/`unitId`, which costs one extra read.

### B: Database row-level security (Supabase RLS)
| Dimension | Assessment |
|---|---|
| Complexity | High: policies per table, and the API connects as one role |
| Cost | A week or more |
| Risk | Medium: easy to lock the app out |

**Pros:** enforced below the app. **Cons:** the API uses a single connection role, so RLS would need per-request role switching. Poor fit now.

### C: Do nothing and rely on trusted committee members
**Pros:** no work. **Cons:** one compromised or careless admin account can edit or delete any district's events, polls and news, and the audit log would show a legitimate-looking admin.

## Trade-off analysis

A is the smallest change that removes the real risk and also gives CI something to assert. B is stronger in theory but does not match how this app talks to the database. C is not acceptable once more than the founding committee has admin rights.

## Consequences

- Admins can no longer edit outside their own district or unit. Anything that relied on that (for example a State-run event owned by a district) must be assigned to the right owner or done by the State account.
- Every new write route needs a scope test, which becomes a review checklist item.
- Rotating the encryption key (#5) becomes possible, but it needs a one-time re-encrypt (`scripts/encrypt-backfill.js` is a starting point).

## Action items

1. [x] Add `COPY css ./css` to the `Dockerfile` (done in the working tree, not yet committed or pushed).
2. [ ] Push `Dev` (needs GitHub sign-in), then redeploy on Render and confirm styles load.
3. [x] Built `src/middleware/scope.js` and applied it to events, polls, cricket, sponsors (and sponsor payments), store, growth, units approve/reject, news, and `GET/PATCH /members/:id`, `/members/:id/card`, `/members/:id/role`. 22 new tests (48 total). Verified live: a district admin now gets 403 on another district's event and member, 200 on their own.
4. [ ] Replace `nextMemberNumber` with a sequence; require an `APPROVED` unit at `/register`.
5. [ ] Add `connection_limit=8&pool_timeout=30` to the production `DATABASE_URL` and `docs/DEPLOY.md`.
6. [ ] Rotate the Supabase database password (it was shared in chat) and any dev secret that was ever committed.
7. [ ] Plan the CSP/XSS clean-up, token revocation and crypto v2 as follow-up work.
8. [ ] Clear machine-made posts and rejected test units from the dev schema before sharing the site.

## Update: scope enforcement implemented

Rules now enforced server-side (`src/middleware/scope.js`): the State Committee acts anywhere; a district admin only on records in their district; a unit admin only on records in their unit; anyone can manage records they created. Also closed while doing this:

- `GET /cricket/trials/:id/applications` exposed applicants' phone numbers to every unit admin in the state.
- `GET /members/:id/card` gave any unit admin a valid verification link for any member.
- `PATCH /members/:id/role` let a district admin change anyone's role statewide, including peer admins.
- `GET /store/orders`, order receipts and `GET /payments/sponsors/payments` showed every district's data to any district admin.
- Non-state admins can no longer create state-wide events, polls or news; sponsors with no district are State-only.
- `POST /growth/referrals` now rejects self-referral and unknown members.

New rule for future routes: load the record, call `assertCanManage(req.auth, scope)`, then write, and add a case to `test/scope-routes.test.js`.
