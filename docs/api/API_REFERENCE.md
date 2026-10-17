# AKDFA API Reference

Base URL: `/api/v1`. Auth: `Authorization: Bearer <accessToken>`. Roles are hierarchical — `MEMBER < UNIT_ADMIN < DISTRICT_ADMIN < STATE_ADMIN`; "Requires X" means X or higher.

Full request/response shapes are defined by the route handlers in `backend/src/modules/**/*.routes.js` and validated with `zod` — treat this doc as the map, the code as the contract.

## Auth — `/auth` (Phase 1)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | Creates a `PENDING` member under a given `unitId`; notifies that unit's and district's admins. Pending (and lapsed/suspended/rejected) members can browse public content but get `403` on member actions (RSVP, vote, order, feedback, trial apply, predict, referral) until `ACTIVE` — enforced by `requireActive` |
| POST | `/auth/login` | — | Returns `accessToken` + `refreshToken` |
| POST | `/auth/refresh` | — | Rotates the refresh token, issues a new pair |
| POST | `/auth/logout` | — | Revokes a refresh token |
| GET | `/auth/me` | Member | Current member profile |

## Authorization scope

Role level alone never grants access to a record. State admins act anywhere; district admins only on records in their own district; unit admins only on records in their own unit; creators can always manage their own items. Out-of-scope requests return `403`. Lists (members, store orders, sponsor payments) are filtered the same way.

## Districts & units — `/districts`, `/units` (Phase 0/1/3/4)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/districts` | — | All 14 districts, with unit/member counts |
| GET | `/districts/:id` | — | District detail + its units |
| POST | `/districts` | State admin | Create a district |
| PATCH | `/districts/:id` | State admin | Edit district (bio, banner, etc.) |
| GET | `/units` | — | Filter by `districtId`, `status` (default `APPROVED`) |
| GET | `/units/:id` | — | Unit detail + teams |
| POST | `/units` | Member | Propose a new unit → lands `PENDING`. A district admin (own district) or the State admin creates it `APPROVED` straight away |
| POST | `/units/:id/approve` | District admin | Approves a pending unit |

## Members — `/members` (Phase 2/3/4)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/members` | Unit admin | Directory; unit/district admins are scoped to their own unit/district. `?status=` filter |
| GET | `/members/me/dashboard` | Member | Aggregate: member, badges, referrals, unread count, upcoming RSVPs, latest fee |
| GET | `/members/:id` | Member (self or admin) | Single member + badges |
| GET | `/members/:id/card` | Member (self or admin) | Digital membership card data (ACTIVE only) |
| POST | `/members/:id/approve` | Unit admin | `PENDING → ACTIVE`, 1-year expiry, marks referral JOINED, sends welcome notification |
| PATCH | `/members/:id` | Member (self) | Update own profile (`fullName`, `phone`, `profilePhotoUrl`) |
| POST | `/members/:id/reset-password` | State admin | Resets an **admin** account's password (regular members are refused; they use `/auth/forgot-password`). No body → one-time reset link (emailed, returned as `resetUrl`, valid 24 h); `{ password }` → temporary password. Signs the account out everywhere; audit-logged |
| PATCH | `/members/:id/role` | District admin | Change role; granting `DISTRICT_ADMIN`/`STATE_ADMIN` requires State admin |

## Uploads — `/uploads`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/uploads` | Member | multipart `file` (image/PDF, ≤8 MB) → `{ url, filename, mimeType, size }` |

## News — `/news` (Phase 1/2)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/news` | — | Filter by `districtId`, `scope`; published only |
| GET | `/news/:id` | — | Post detail |
| POST | `/news` | Unit admin | State-scope posts require State admin |
| DELETE | `/news/:id` | Unit admin | |

## Events — `/events` (Phase 1/2)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/events` | — | Filter by `districtId`, `type`, `from`/`to` |
| GET | `/events/:id` | — | Detail + RSVPs + linked matches |
| POST | `/events` | Unit admin | |
| PATCH | `/events/:id` | Unit admin | |
| DELETE | `/events/:id` | Unit admin | |
| POST | `/events/:id/rsvp` | Member | `GOING` / `INTERESTED` / `NOT_GOING` |

## Polls — `/polls` (Phase 2)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/polls` | Member | Includes live vote counts per option |
| POST | `/polls` | Unit admin | Creates poll + options in one call |
| POST | `/polls/options/:optionId/vote` | Member | One vote per option per member |

## Cricket hub — `/cricket` (Phase 2/3)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/cricket/teams` | — | Filter by `unitId` |
| GET | `/cricket/teams/:id` | — | Roster included |
| POST | `/cricket/teams` | Unit admin | |
| PATCH | `/cricket/teams/:id` | Unit admin | Rename, change captain |
| POST | `/cricket/teams/:teamId/players` | Unit admin | Adds a member to the roster |
| GET | `/cricket/matches` | — | Filter by `teamId`, `status` |
| POST | `/cricket/matches` | Unit admin | Schedule a match |
| PATCH | `/cricket/matches/:id/result` | Unit admin | Score, status, and per-player stats in one call |
| POST | `/cricket/matches/:id/predict` | Member | "Guess the result" |
| GET | `/cricket/trials` | — | Filter by `teamId` |
| POST | `/cricket/trials` | Unit admin | |
| POST | `/cricket/trials/:id/apply` | Member | Put your name forward |
| PATCH | `/cricket/trials/applications/:id` | Unit admin | Shortlist / select / reject |

## Sponsors — `/sponsors` (Phase 1/3/5)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/sponsors` | — | Public sponsors only |
| POST | `/sponsors/leads` | — | Public "become a sponsor" form → logged as a contact message |
| POST | `/sponsors` | District admin | Create a sponsor record (omit `districtId` for state-level) |
| GET | `/sponsors/districts/:districtId/logs` | District admin | Local income/expense log |
| POST | `/sponsors/districts/:districtId/logs` | District admin | Log a local sponsorship or expense |

## Badges & referrals — `/growth` (Phase 2)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/growth/badges` | — | |
| POST | `/growth/badges` | District admin | Define a new badge |
| POST | `/growth/badges/:badgeId/award/:memberId` | Unit admin | |
| GET | `/growth/me/badges` | Member | |
| POST | `/growth/referrals` | Member | Record who you referred |
| GET | `/growth/me/referrals` | Member | |
| POST | `/growth/referrals/:id/reward` | Unit admin | Mark a referral rewarded |

## Notifications — `/notifications` (Phase 2/4)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/notifications/me` | Member | Latest 100 |
| PATCH | `/notifications/:id/read` | Member | |
| POST | `/notifications/broadcast` | State admin | Omit `districtId` to send to everyone |
| GET | `/notifications/me/preferences` | Member | |
| PUT | `/notifications/me/preferences` | Member | Upsert one category/channel preference |

## District reporting — `/reports` (Phase 4)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/reports` | District admin | State admin can pass `districtId`; district admin is scoped to their own |
| POST | `/reports` | District admin | Upsert this month's report |
| GET | `/reports/state-overview` | State admin | Membership, active count, district count, total fees collected |

## Admin — `/admin` (Phase 4)

Official documents are stored **outside the web root**; the file bytes are only
served through the visibility-checked streaming routes below (never a static URL).
Upload / update / delete are all written to the audit log.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/documents` | Member | STATE_ADMIN → all; DISTRICT_ADMIN/member → `PUBLIC` + `DISTRICT_ONLY` for their own district. `fileKey` is never returned |
| GET | `/admin/documents/:id/file` | per-document | Streams the file after re-checking visibility (`PUBLIC` works anonymously) |
| POST | `/admin/documents` | District admin | **multipart/form-data**: `file` + `title`, `type`, `visibility`, optional `districtId` (state admin only). Max 20 MB, PDF/Word/image/text |
| PATCH | `/admin/documents/:id` | District admin (own district) / state admin | Edit `title`, `type`, `visibility`, `districtId` |
| DELETE | `/admin/documents/:id` | District admin (own district) / state admin | Removes the row and the underlying file |
| GET | `/admin/audit-logs` | State admin | Filter by `entityType`, `entityId`. Now includes `DOCUMENT_UPLOADED/UPDATED/DELETED` |

## Public — `/public` additions

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/public/documents` | — | Metadata for `PUBLIC` documents (for the website) |
| GET | `/public/documents/:id/file` | — | Streams a `PUBLIC` document; 404 for anything else |

## Payments — `/payments` (Phase 5)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/payments/membership-fees/:period/checkout` | Member | Creates a Razorpay order for that membership year |
| GET | `/payments/membership-fees/me` | Member | Payment history |
| POST | `/payments/verify` | Member | Browser checkout confirmation: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` — verifies + marks paid |
| POST | `/payments/webhook` | — (HMAC-verified) | Razorpay webhook; marks fees/orders/sponsor payments paid, extends membership |
| POST | `/payments/sponsors/:sponsorId/checkout` | Member (staff) | Creates a Razorpay order for a sponsor payment |

## Store — `/store` (Phase 5)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/store/products` | Optional | Shows member price when authenticated |
| POST | `/store/products` | State admin | |
| POST | `/store/orders` | Member | Validates stock, computes total, creates Razorpay order |
| GET | `/store/orders/me` | Member | |
| GET | `/store/orders` | District admin | All orders; `?status=` filter |
| PATCH | `/store/orders/:id/status` | District admin | Fulfilment tracking |

## Cricket additions

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/cricket/matches/:id` | — | Match + player stats + prediction count |
| GET | `/cricket/trials/:id/applications` | Unit admin | Applicants for a trial |

## Polls / sponsors additions

- `GET /polls` now returns `myOptionId` and `totalVotes` per poll; voting an option clears any prior vote on the same poll.
- `GET /sponsors?scope=all` (District admin+) also returns non-public sponsor records.

## Public — `/public` (Phase 0/1)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/public/newsletter` | — | Newsletter signup |
| POST | `/public/newsletter/unsubscribe` | — | |
| POST | `/public/contact` | — | Contact form submission |

## Feedback — `/feedback` (Phase 2 — "feedback straight to your unit leaders")

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/feedback` | Member | `{ subject, message }` → goes to the member's unit; notifies unit/district admins |
| GET | `/feedback/me` | Member | The member's own threads + any replies |
| GET | `/feedback` | Unit admin | Inbox — unit admin sees their unit, district admin their district. `?status=` |
| PATCH | `/feedback/:id` | Unit admin (own scope) | `{ status?, response? }` — a `response` notifies the member |

## Reports additions

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/reports` | District admin | State admin now gets `district` + `submittedBy` on each row (all districts) |
| GET | `/reports/trends` | State admin | 12-month series of `newMembers` + `feesCollected`, plus per-district counts |

## Events / cricket additions (Phase 3 — "scores, brackets, photos, charity reports")

| Method | Path | Auth | Notes |
|---|---|---|---|
| PATCH | `/events/:id/photos` | Unit admin | `{ photos: [url] }` — replace an event's photo list |
| PATCH | `/events/:id` | Unit admin | now also accepts `photos`, `bracket` (JSON) |
| GET | `/events/:id/charity-report` | — | The charity report for a CHARITY event |
| PUT | `/events/:id/charity-report` | Unit admin | Upsert `{ peopleHelped, amountRaised, amountSpent, beneficiary, summary, photos }` |
| PATCH | `/cricket/matches/:id/result` | Unit admin | now also accepts `photos: [url]` |
| GET | `/districts/:id/showcase` | — | "Brought to life": story, upcoming events, recent results, charity impact |

## Notifications

- `POST /notifications/broadcast` is now **District admin+**. A district admin can only broadcast to their own district; a state admin can target one district or everyone.

## Payments additions (Phase 5 — receipts, invoices, sponsor pay links)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/payments/membership-fees/:id/receipt` | Member (self) / admin | HTML receipt (browser → Save as PDF); `receiptUrl` set on payment success |
| GET | `/store/orders/:id/receipt` | Member (self) / admin | HTML order receipt |
| POST | `/payments/sponsors/:sponsorId/request` | District admin | `{ amount, note? }` → `{ payUrl }` — shareable link for the sponsor |
| GET | `/payments/sponsors/payments` | District admin | All sponsor payments |
| GET | `/payments/sponsor-payments/by-token/:token` | — | Sponsor loads their pay link |
| POST | `/payments/sponsor-payments/by-token/:token/checkout` | — | Creates the Razorpay order |
| POST | `/payments/sponsor-payments/by-token/:token/verify` | — | Confirms payment, issues an invoice number |
| GET | `/payments/sponsor-payments/:id/invoice` | — (paid only) | HTML tax invoice |

On any successful payment (verify or webhook) a receipt/invoice URL is generated and, for membership fees, the member is marked `ACTIVE` with a fresh expiry and a `PAYMENT` notification.

## Public additions

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/news` | — | (was already public) now returned with `district` for the public feed |
| GET | `/events` | — | now returns `district` per event for the public calendar |

## Scheduled job

`npm run reminders` (`scripts/send-reminders.js`) — creates renewal-reminder notifications for members expiring within 30 days and moves overdue members to `LAPSED`. Run daily via cron / Task Scheduler.

## Auth — password management

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/forgot-password` | — | `{ email }` — always 200; emails a 1-hour reset link. In non-prod the response also carries `devResetUrl` |
| POST | `/auth/reset-password` | — | `{ token, password }` — sets the password, revokes all refresh tokens |
| POST | `/auth/change-password` | Member | `{ currentPassword, newPassword }` — revokes other sessions, returns a fresh token pair |

## Membership card verification

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/members/:id/card` | Member/admin | now also returns `verifyUrl` (signed) for the QR |
| GET | `/public/members/verify?m=&sig=` | — | Gate check: `{ valid, reason, member }`; `sig` is a keyed HMAC of the member number |

## CRUD additions (portal "edit / delete" gaps)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/members/:id/reject` | Unit admin | Pending → `REJECTED` (can't log in) |
| POST | `/units/:id/reject` | District admin | Pending unit → `REJECTED` |
| PATCH | `/polls/:id` · POST `/polls/:id/close` · DELETE `/polls/:id` | Unit admin | Edit / close early / delete; voting a closed poll is rejected |
| PATCH | `/store/products/:id` | State admin | Price, stock, `isActive`, … |
| GET | `/store/products?all=true` | State admin | Includes hidden products |
| PATCH `/sponsors/:id` · DELETE `/sponsors/:id` | | District admin | Edit / remove; `isPublic` toggle |
| DELETE | `/cricket/players/:id` | Unit admin | Remove a player from a roster |

Deleting a news post or event now also removes its uploaded images.

## Notifications

Notification creation runs through `notify()` (`src/modules/notifications/notify.service.js`), which skips members who have disabled **every** channel for that category. `ANNOUNCEMENT` broadcasts, payment receipts, feedback and approvals are sent with `force` and always deliver.

## Environment

`backend/src/config/env.js` loads `.env.<NODE_ENV>.local` → `.env.local` → `.env.<NODE_ENV>` → `.env` (first wins; real host env beats all). Commit `.env.development` (safe defaults) and `.env.production` (template); keep secrets in `.env` / `*.local`. In `NODE_ENV=production` the server refuses to boot without `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`.

## Error shape

```json
{ "error": { "message": "Human-readable reason", "details": { "...": "optional, e.g. zod validation issues" } } }
```

Standard status codes: `400` validation, `401` missing/invalid token, `403` role/ownership check failed, `404` not found, `409` conflict (duplicate email, etc.), `503` a dependent integration (e.g. Razorpay) isn't configured yet.
