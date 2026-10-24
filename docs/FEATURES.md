# AKDFA system: complete functionality list

Built from the code (routes, screens, schema, scripts). "Needs setup" means the feature exists but is inactive until you configure something.

## 1. Roles and access

| Role | Who | Scope |
|---|---|---|
| Visitor | anyone | public website only |
| Member | approved fan | own profile, community features |
| Unit admin | runs one unit | members, events, cricket, polls of that unit |
| District admin | runs one district | everything in the district, plus sponsors, store orders, reports, broadcasts |
| State admin (State Committee) | top level | everything statewide, roles, audit log, store products |

Membership status: Pending, Active, Lapsed, Suspended, Rejected. Admin actions are limited to the admin's own unit or district (enforced server-side), and a member can always manage what they created.

## 2. Public website (no login)

- **Home:** hero banner, quick links, stats and latest State Committee news (live from the API), Dhoni six video (click to play), honours, join banner.
- **About:** story, journey, values, official documents (public bylaws, circulars, minutes).
- **Our Units:** the 17 units (14 districts plus Chennai, Bangalore and the Ladies unit) with member counts, unit details, contact options and district stories and events.
- **Updates:** events calendar with type filters and a Charity section (events the State Committee adds), news feed, press mentions, newsletter signup.
- **Gallery:** photos attached to the State Committee's events, grouped by event type, with a full-screen viewer.
- **Sponsors:** sponsors the State Committee adds, partnership tiers and an enquiry form.
- **Contact:** enquiry form, WhatsApp group, social links.
- **Join:** membership request form (name, phone, email, district, unit, password) with the annual fee shown up front.
- **Sign in / Forgot password / Reset password.**
- **Membership verify page:** opens from the QR/verify link on a member card, or lets anyone type a membership number to see if the person is an active member (masked name only).
- **Sponsor pay page:** a sponsor opens a private pay link, pays, and gets an invoice.
- Light and dark theme with a toggle (follows the device setting); responsive on phones.

## 3. Account and security

- Self-registration (lands Pending); admins of that unit and district are notified.
- Login with access and refresh tokens, silent refresh, logout, change password, forgot and reset password by emailed link.
- State admin can reset an admin account's password (link or temporary password); members always reset their own.
- Personal data (name, email, phone) encrypted at rest with searchable blind indexes.
- Rate limiting, secure headers (Helmet), input validation on every endpoint, audit log of sensitive admin actions.

## 4. Member app (after sign-in)

- **Dashboard:** status, badges, referrals, unread notifications, upcoming events you are attending, digital card preview.
- **Digital card:** membership card with the member's photo, QR/verify link and validity date.
- **Profile and badges:** edit name, phone, photo; change password; referral link and list; badges earned.
- **Membership fee:** pay yearly fee online, payment history, downloadable receipt (needs Razorpay setup).
- **News feed:** state, district and unit posts.
- **Events:** calendar with district and type filters; RSVP Going, Interested, Can't go.
- **Polls:** vote (one vote, changeable), live results.
- **Feedback:** send feedback to your unit; see replies.
- **Notifications:** in-app inbox, mark read, preferences by category and channel.
- **Cricket hub:** teams and rosters, fixtures and results, trials (apply), match predictions.
- **AKDFA Store:** browse merchandise, cart, size options, member pricing, checkout, receipt (needs Razorpay setup).
- **My orders:** order status and receipts.

## 5. Committee tools

**Unit admin and above**
- **Members:** add a member who joined in person (sends a set-your-password link), approve or reject pending sign-ins (the member gets a welcome email), suspend and reinstate members, filter by status, change roles (district admin and above).
- **Feedback inbox:** read, set status (Open, Acknowledged, Resolved), reply.
- **Manage cricket:** create teams, add or remove players, set captains, schedule matches, submit results and player stats, post trials and review applications.
- **Content:** create events (types: tournament, charity, match, meeting, trial, other) with photos and brackets, charity reports (people helped, amount raised and spent), create and close polls.
- Award badges and reward referrals to members in your unit or district.

**District admin and above**

- **Broadcast:** send announcements to your district (urgent ones always land).
- **Sponsors and logs:** manage sponsors, log sponsorship income and expenses, raise payment requests with a shareable pay link.
- **Store orders:** see your district's orders, update status (Processing, Shipped, Delivered, Cancelled).
- **District report:** submit and view periodic district reports.
- **Documents:** upload, edit and delete documents with visibility Public, State only or District only.

**State Committee**
- **State overview:** totals, new-member and fee-collection trends, per-district table.
- **District reports:** all districts' reports.
- **Roles and audit:** full audit trail of admin actions.
- **Store products:** create and edit products, prices, sizes and stock.
- **Units:** the State Committee adds and deletes units (a unit with members can't be deleted). The admin Units screen lists exactly the units shown on the public Units page.
- **News:** only the State Committee posts news; the home page, Updates and the member feed show only those posts.
- Create and edit districts; state-wide events, polls and sponsors.

## 6. Payments and commerce

- Membership fee checkout, verification and receipts.
- Store checkout, order tracking and receipts.
- Sponsor payment requests with a private link, payment and invoice.
- Razorpay gateway with webhook; all payment features switch on when keys are added.

## 7. Notifications and automation

- In-app notifications for approvals, announcements, signup alerts, events and payments.
- Per-member notification preferences by category and channel (in-app, email, SMS settings are stored; email sends only when SMTP is configured, otherwise it is logged; there is no SMS provider yet).
- Daily reminder job (`backend/scripts/send-reminders.js`) for memberships expiring within 30 days (needs a scheduler such as a Render cron job).

## 8. Files and data

- Uploads: profile photos, news covers, event photos, product images, documents (images, PDF, Word, text). Local disk or S3-compatible storage (Supabase Storage); private documents are kept separate.
- Database: Supabase Postgres via Prisma, 37 tables, migrations applied on deploy.
- Tools: seed script (districts, units, admin, demo data), smoke and end-to-end test scripts, encryption backfill script, 48 automated tests.

## 9. Hosting

- One Docker service serves both the website and the API (Render blueprint included). CI runs syntax checks and tests on every push.
