# AKDFA API Reference

Base URL: `/api/v1`. Auth: `Authorization: Bearer <accessToken>`. Roles are hierarchical — `MEMBER < UNIT_ADMIN < DISTRICT_ADMIN < STATE_ADMIN`; "Requires X" means X or higher.

Full request/response shapes are defined by the route handlers in `backend/src/modules/**/*.routes.js` and validated with `zod` — treat this doc as the map, the code as the contract.

## Auth — `/auth` (Phase 1)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | Creates a `PENDING` member under a given `unitId` |
| POST | `/auth/login` | — | Returns `accessToken` + `refreshToken` |
| POST | `/auth/refresh` | — | Rotates the refresh token, issues a new pair |
| POST | `/auth/logout` | — | Revokes a refresh token |
| GET | `/auth/me` | Member | Current member profile |

## Districts & units — `/districts`, `/units` (Phase 0/1/3/4)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/districts` | — | All 14 districts, with unit/member counts |
| GET | `/districts/:id` | — | District detail + its units |
| POST | `/districts` | State admin | Create a district |
| PATCH | `/districts/:id` | State admin | Edit district (bio, banner, etc.) |
| GET | `/units` | — | Filter by `districtId`, `status` (default `APPROVED`) |
| GET | `/units/:id` | — | Unit detail + teams |
| POST | `/units` | Member | Propose a new unit → lands `PENDING` |
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

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/documents` | Member | State admin sees all; others see public + own district |
| POST | `/admin/documents` | District admin | Bylaws, minutes, circulars |
| DELETE | `/admin/documents/:id` | District admin | |
| GET | `/admin/audit-logs` | State admin | Filter by `entityType`, `entityId` |

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

## Error shape

```json
{ "error": { "message": "Human-readable reason", "details": { "...": "optional, e.g. zod validation issues" } } }
```

Standard status codes: `400` validation, `401` missing/invalid token, `403` role/ownership check failed, `404` not found, `409` conflict (duplicate email, etc.), `503` a dependent integration (e.g. Razorpay) isn't configured yet.
