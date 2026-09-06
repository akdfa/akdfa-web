# AKDFA Frontend

Two surfaces, one API.

## Public site (repo root)

Static HTML pages sharing `style.css` + `script.js`. Live behaviour is added by two extra
scripts loaded on every page:

- `js/api.js` — the `window.AKDFA` client (token storage, auto-refresh, helpers).
- `js/public.js` — wires the page forms: contact → `/public/contact`, sponsor lead →
  `/sponsors/leads`, newsletter → `/public/newsletter`, `join.html` → `/auth/register`,
  `login.html` → `/auth/login` then redirect to `app.html`. Also swaps the "Sign In" nav
  link for "My AKDFA" when a session exists.

Forms degrade gracefully: if the API is unreachable the user gets a plain message, never a
broken page.

## Member & Committee portal (`app.html`)

A single-page app — no framework, no build step.

| File | Role |
|---|---|
| `app.html` | shell: sidebar, topbar, `#portalView` mount point |
| `css/app.css` | portal styling, layered on `style.css` design tokens |
| `js/app.js` | everything else |

### How `js/app.js` is organised

- **Boot** (`boot()`): redirects to `login.html` if there's no session, otherwise fetches
  `/auth/me`, builds the role-aware sidebar (`NAV`), starts the router.
- **Router**: `hashchange` → `routes[path]`. Each route is
  `R(path, title, { role?, render, after? })`.
  - `render(query)` returns an HTML string.
  - `after()` runs once after mount for event wiring; the view node is replaced on every
    navigation so listeners never stack up.
  - `role` gates the route (`MEMBER < UNIT_ADMIN < DISTRICT_ADMIN < STATE_ADMIN`).
- **Global actions** (`wireGlobalActions`): delegated `data-act` handlers shared across views
  — RSVP, poll vote, view roster, match prediction, trial application.
- **Payments** (`payWithRazorpay`): loads Razorpay checkout, then calls `/payments/verify`.

### Adding a page

```js
R("/my-thing", "My Thing", {
  role: "DISTRICT_ADMIN",            // optional
  render: async () => {
    const { things } = await api.get("/things");
    return `<div class="pv-head"><h1>My Thing</h1></div> …`;
  },
  after: () => { /* wire buttons via view().addEventListener */ },
});
```

Then add it to the `NAV` array so it appears in the sidebar.

### API base URL

`js/api.js` resolves the base in this order: `localStorage["akdfa.apiBase"]` →
`window.AKDFA_API_BASE` → `<current-host>:4000` → `http://localhost:4000`.
