# AKDFA — Entity Relationship Diagrams

Source of truth for the schema is [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma). These diagrams are a human-readable view of the same model, grouped by phase so each one stays legible. A full master diagram (entities + relationships only, no columns) is at the bottom.

Regenerate an interactive version anytime with `npx prisma studio` (needs `DATABASE_URL` set) or `npx prisma-erd-generator` against the schema file. The exact DDL is in [`SCHEMA.sql`](SCHEMA.sql).

### Changes since first draft (not all redrawn below)

- **PII encryption**: `MEMBER.email/phone` are AES-GCM ciphertext with `emailHash` / `phoneHash` blind-index columns for lookup; `MEMBER.dateOfBirth` is an encrypted string; `UNIT` / `SPONSOR` contact fields, `SPONSORSHIP_LOG` text, `DOCUMENT.fileKey`, `NEWSLETTER_SUBSCRIBER.email`, `CONTACT_MESSAGE` and `FEEDBACK` bodies are encrypted.
- **`DOCUMENT`**: `fileUrl` → `fileKey` (private on-disk name) plus `mimeType` / `originalName` / `fileSize`.
- **New entities**: `PASSWORD_RESET` (Member 1—* ), `FEEDBACK` (Member/Unit), `CHARITY_REPORT` (Event 1—1), plus `EVENT.photos[]` / `EVENT.bracket` / `MATCH.photos[]`, `MEMBER.renewalReminderAt`, `SPONSOR_PAYMENT.payToken` / `note` / `paidAt`.
- **`MembershipStatus`** gains `REJECTED`.

## 1. Org structure & auth (Phase 0/1)

```mermaid
erDiagram
    DISTRICT ||--o{ UNIT : contains
    DISTRICT ||--o{ MEMBER : "denormalized for queries"
    UNIT ||--o{ MEMBER : has
    MEMBER ||--o{ REFRESH_TOKEN : owns
    MEMBER ||--o{ AUDIT_LOG : "acts as (actor)"
    MEMBER ||--o{ DOCUMENT : uploads
    DISTRICT ||--o{ DOCUMENT : "scoped to (optional)"
    MEMBER |o--o{ UNIT : "approves (unit_admin/district_admin)"
    MEMBER |o--o{ MEMBER : "approves new members"

    DISTRICT {
        string id PK
        string name
        string code
        string region
        text bio
    }
    UNIT {
        string id PK
        string districtId FK
        string name
        enum status "PENDING/APPROVED/REJECTED"
        string approvedById FK
    }
    MEMBER {
        string id PK
        string unitId FK
        string districtId FK
        string memberNumber UK
        string fullName
        string email UK
        string phone UK
        string passwordHash
        enum role "MEMBER/UNIT_ADMIN/DISTRICT_ADMIN/STATE_ADMIN"
        enum status "PENDING/ACTIVE/LAPSED/SUSPENDED"
        string approvedById FK
        datetime membershipExpiresAt
    }
    REFRESH_TOKEN {
        string id PK
        string memberId FK
        string tokenHash UK
        datetime expiresAt
        datetime revokedAt
    }
    AUDIT_LOG {
        string id PK
        string actorId FK
        string action
        string entityType
        string entityId
        json metadata
    }
    DOCUMENT {
        string id PK
        string title
        string type
        string fileUrl
        enum visibility "PUBLIC/STATE_ONLY/DISTRICT_ONLY"
        string districtId FK
        string uploadedById FK
    }
```

## 2. Content & engagement (Phase 1/2)

```mermaid
erDiagram
    MEMBER ||--o{ NEWS_POST : authors
    DISTRICT |o--o{ NEWS_POST : "scoped to (optional)"
    MEMBER ||--o{ EVENT : creates
    DISTRICT |o--o{ EVENT : "scoped to (optional)"
    UNIT |o--o{ EVENT : "scoped to (optional)"
    EVENT ||--o{ EVENT_RSVP : receives
    MEMBER ||--o{ EVENT_RSVP : sends
    MEMBER ||--o{ POLL : creates
    POLL ||--o{ POLL_OPTION : has
    POLL_OPTION ||--o{ POLL_VOTE : receives
    MEMBER ||--o{ POLL_VOTE : casts
    MEMBER |o--o{ NOTIFICATION : receives
    DISTRICT |o--o{ NOTIFICATION : "broadcasts to (optional)"
    MEMBER ||--o{ NOTIFICATION_PREFERENCE : configures

    NEWS_POST {
        string id PK
        string title
        text body
        enum scope "STATE/DISTRICT/UNIT"
        string districtId FK
        string authorId FK
        datetime publishedAt
    }
    EVENT {
        string id PK
        string title
        enum type "TOURNAMENT/CHARITY/MATCH/MEETING/TRIAL/OTHER"
        enum scope "STATE/DISTRICT/UNIT"
        string districtId FK
        string unitId FK
        datetime startsAt
        datetime endsAt
        enum status "PENDING/APPROVED/REJECTED"
        string createdById FK
    }
    EVENT_RSVP {
        string id PK
        string eventId FK
        string memberId FK
        enum status "GOING/INTERESTED/NOT_GOING"
    }
    POLL {
        string id PK
        string question
        enum scope
        string createdById FK
        datetime closesAt
    }
    POLL_OPTION {
        string id PK
        string pollId FK
        string label
    }
    POLL_VOTE {
        string id PK
        string optionId FK
        string memberId FK
    }
    NOTIFICATION {
        string id PK
        string memberId FK "nullable — null when broadcast"
        string broadcastDistrictId FK "nullable"
        string title
        string category
        enum channel "EMAIL/PUSH/SMS"
        datetime readAt
    }
    NOTIFICATION_PREFERENCE {
        string id PK
        string memberId FK
        string category
        enum channel
        boolean enabled
    }
```

## 3. Cricket hub (Phase 2/3)

```mermaid
erDiagram
    UNIT ||--o{ TEAM : fields
    MEMBER |o--o{ TEAM : captains
    TEAM ||--o{ PLAYER : rosters
    MEMBER ||--o| PLAYER : "is (one profile)"
    TEAM ||--o{ MATCH : "plays as home"
    TEAM ||--o{ MATCH : "plays as away"
    EVENT |o--o{ MATCH : "part of (optional)"
    MATCH ||--o{ PLAYER_MATCH_STAT : records
    PLAYER ||--o{ PLAYER_MATCH_STAT : has
    MATCH ||--o{ MATCH_PREDICTION : receives
    MEMBER ||--o{ MATCH_PREDICTION : makes
    TEAM ||--o{ TRIAL : holds
    EVENT |o--o{ TRIAL : "part of (optional)"
    TRIAL ||--o{ TRIAL_APPLICATION : receives
    MEMBER ||--o{ TRIAL_APPLICATION : submits

    TEAM {
        string id PK
        string unitId FK
        string name
        string season
        string captainId FK
    }
    PLAYER {
        string id PK
        string memberId FK UK
        string teamId FK
        int jerseyNumber
        string position
    }
    MATCH {
        string id PK
        string eventId FK
        string homeTeamId FK
        string awayTeamId FK
        datetime scheduledAt
        enum status "SCHEDULED/LIVE/COMPLETED/CANCELLED"
        string resultSummary
    }
    PLAYER_MATCH_STAT {
        string id PK
        string matchId FK
        string playerId FK
        int runs
        int wickets
        int catches
    }
    MATCH_PREDICTION {
        string id PK
        string matchId FK
        string memberId FK
        string predictedWinnerTeamId
    }
    TRIAL {
        string id PK
        string teamId FK
        string eventId FK
        datetime scheduledAt
    }
    TRIAL_APPLICATION {
        string id PK
        string trialId FK
        string memberId FK
        enum status "APPLIED/SHORTLISTED/SELECTED/REJECTED"
    }
```

## 4. Sponsors (Phase 1/3/5)

```mermaid
erDiagram
    DISTRICT |o--o{ SPONSOR : "local sponsor of (optional = state-level)"
    SPONSOR ||--o{ SPONSOR_PAYMENT : pays
    DISTRICT ||--o{ SPONSORSHIP_LOG : tracks
    MEMBER ||--o{ SPONSORSHIP_LOG : logs

    SPONSOR {
        string id PK
        string name
        enum tier "PLATINUM/GOLD/SILVER/BRONZE/COMMUNITY"
        string districtId FK "nullable"
        boolean isPublic
    }
    SPONSOR_PAYMENT {
        string id PK
        string sponsorId FK
        decimal amount
        enum status "PENDING/SUCCESS/FAILED/REFUNDED"
        string gatewayRef
        string invoiceNumber UK
    }
    SPONSORSHIP_LOG {
        string id PK
        string districtId FK
        string sponsorName
        decimal amount
        string type "INCOME/EXPENSE"
        string loggedById FK
    }
```

## 5. Badges & referrals (Phase 2)

```mermaid
erDiagram
    MEMBER ||--o{ MEMBER_BADGE : earns
    BADGE ||--o{ MEMBER_BADGE : "awarded as"
    MEMBER ||--o| REFERRAL : "refers (as referrer, many)"
    MEMBER ||--|| REFERRAL : "is referred (as referred, one)"

    BADGE {
        string id PK
        string name UK
        string criteria
    }
    MEMBER_BADGE {
        string id PK
        string memberId FK
        string badgeId FK
        datetime awardedAt
    }
    REFERRAL {
        string id PK
        string referrerId FK
        string referredId FK UK
        enum status "PENDING/JOINED/REWARDED"
        datetime rewardGrantedAt
    }
```

## 6. District → state reporting (Phase 4)

```mermaid
erDiagram
    DISTRICT ||--o{ DISTRICT_ACTIVITY_REPORT : files
    MEMBER ||--o{ DISTRICT_ACTIVITY_REPORT : submits

    DISTRICT_ACTIVITY_REPORT {
        string id PK
        string districtId FK
        datetime month
        int eventsRun
        int teamsManaged
        string submittedById FK
    }
```

## 7. Payments & store (Phase 5)

```mermaid
erDiagram
    MEMBER ||--o{ MEMBERSHIP_FEE : pays
    MEMBER ||--o{ ORDER : places
    ORDER ||--o{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : "ordered as"

    MEMBERSHIP_FEE {
        string id PK
        string memberId FK
        int period "membership year"
        decimal amount
        enum status "PENDING/SUCCESS/FAILED/REFUNDED"
        string gatewayRef
    }
    PRODUCT {
        string id PK
        string name
        string category "JERSEY/CAP/SCARF"
        decimal price
        decimal memberPrice
        int stock
    }
    ORDER {
        string id PK
        string memberId FK
        enum status "PENDING/PAID/PROCESSING/SHIPPED/DELIVERED/CANCELLED"
        decimal totalAmount
        string gatewayRef
    }
    ORDER_ITEM {
        string id PK
        string orderId FK
        string productId FK
        string size
        int quantity
        decimal unitPrice
    }
```

## Master diagram (entities + relationships only)

```mermaid
erDiagram
    DISTRICT ||--o{ UNIT : contains
    UNIT ||--o{ MEMBER : has
    MEMBER ||--o{ REFRESH_TOKEN : owns
    MEMBER ||--o{ AUDIT_LOG : acts_as
    MEMBER ||--o{ DOCUMENT : uploads
    MEMBER ||--o{ NEWS_POST : authors
    MEMBER ||--o{ EVENT : creates
    EVENT ||--o{ EVENT_RSVP : receives
    MEMBER ||--o{ EVENT_RSVP : sends
    MEMBER ||--o{ POLL : creates
    POLL ||--o{ POLL_OPTION : has
    POLL_OPTION ||--o{ POLL_VOTE : receives
    MEMBER ||--o{ POLL_VOTE : casts
    MEMBER ||--o{ NOTIFICATION : receives
    MEMBER ||--o{ NOTIFICATION_PREFERENCE : configures
    UNIT ||--o{ TEAM : fields
    TEAM ||--o{ PLAYER : rosters
    MEMBER ||--o| PLAYER : is
    TEAM ||--o{ MATCH : plays
    MATCH ||--o{ PLAYER_MATCH_STAT : records
    PLAYER ||--o{ PLAYER_MATCH_STAT : has
    MATCH ||--o{ MATCH_PREDICTION : receives
    MEMBER ||--o{ MATCH_PREDICTION : makes
    TEAM ||--o{ TRIAL : holds
    TRIAL ||--o{ TRIAL_APPLICATION : receives
    MEMBER ||--o{ TRIAL_APPLICATION : submits
    DISTRICT ||--o{ SPONSOR : hosts
    SPONSOR ||--o{ SPONSOR_PAYMENT : pays
    DISTRICT ||--o{ SPONSORSHIP_LOG : tracks
    MEMBER ||--o{ MEMBER_BADGE : earns
    BADGE ||--o{ MEMBER_BADGE : awarded_as
    MEMBER ||--o{ REFERRAL : refers
    DISTRICT ||--o{ DISTRICT_ACTIVITY_REPORT : files
    MEMBER ||--o{ MEMBERSHIP_FEE : pays
    MEMBER ||--o{ ORDER : places
    ORDER ||--o{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : ordered_as
```
