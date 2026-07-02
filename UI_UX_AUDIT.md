# AKDFA UI/UX Audit

Audit scope: `index.html`, `admin.html`, `style.css`, and `script.js`.  
Design direction: preserve the existing premium black/gold/green AKDFA identity and improve polish, usability, accessibility, responsiveness, and maintainability.

## Executive Summary

The product already has a strong, recognizable visual identity: black stadium atmosphere, gold highlights, green Dhoni-inspired line work, glass cards, and premium serif hero typography. The direction is brand-right and should not be replaced.

The main issues are polish and systemization: focus states are incomplete, mobile navigation is not fully accessible, the modal lacks focus management, placeholder links are keyboard traps, form behavior is too demo-like, and the stylesheet has grown into a large monolithic file without enough design-system structure. The result feels visually strong but not yet product-grade.

Estimated UI quality: **6.8/10 now**. With the fixes in this audit: **8.7/10** without changing the theme.

## Critical Findings

| Severity | Current Issue | Why It Is A Problem | Fix Recommendation | Theme Impact |
|---|---|---|---|---|
| Critical | Keyboard focus is not consistently visible. Inputs remove native outline in `style.css:1347`, while buttons, links, nav items, social icons, filter buttons, unit cards, and modal close rely mostly on hover styles. | WCAG 2.2 requires visible focus. Keyboard users can lose their place, especially in dark UI. | Add one global `:focus-visible` ring using the existing gold token, then tune component offsets. | ✅ No Theme Change |
| Critical | Modal opens but does not move focus into the dialog or restore focus to the triggering unit card. See modal open/close logic in `script.js:161-207`. | Screen reader and keyboard users remain logically behind the overlay. This violates expected dialog behavior. | Store `lastFocusedElement`, focus `.modal-close` on open, trap Tab inside `.modal-panel`, restore focus on close. | ✅ No Theme Change |
| Critical | Mobile nav toggles `aria-expanded` in `script.js:68-81`, but the nav container has no id/`aria-controls`, no outside click close, and focus is not moved into the menu. | Menu state is not fully understandable to assistive tech and keyboard flow is weaker on mobile. | Give the nav `id="primaryNavigation"`, button `aria-controls`, toggle `aria-label`, focus first link on open, close on outside click/Escape. | ✅ No Theme Change |
| High | WhatsApp links use `href="#"` in `index.html:292` and `index.html:332`. | Placeholder anchors create useless keyboard stops and may scroll to top if JS behavior changes. | Use a disabled-looking `<span>` or real URL. If keeping it pending, use `aria-disabled="true"`, `tabindex="-1"`, and a title. | ✅ No Theme Change |
| High | Demo alerts use blocking `alert()` in `script.js:264-267`. | Native alerts feel unpolished, interrupt browsing, and are not aligned with the premium UI. | Replace with a small themed toast/status component using `role="status"` and `aria-live="polite"`. | ✅ No Theme Change |
| High | `h1, h2, h3, p { overflow-wrap: anywhere; }` in `style.css:101-105` can break brand words aggressively. | It caused the “ASSOCIATION” break problem and can make headings look broken on narrow screens. | Use `overflow-wrap: break-word` for body copy only; keep headings controlled with max-width, clamp sizes, and explicit spans. | ✅ No Theme Change |

## Step 1 - Global UI Audit

### Visual Hierarchy

| Current Issue | Why It Is A Problem | Fix Recommendation | Theme Impact |
|---|---|---|---|
| The hero has only one visible CTA because the primary “Join the Movement” is commented out in `index.html:62`. | The first viewport lacks a clear primary conversion path. “View Activities” is useful but secondary. | Restore a primary `Join AKDFA` CTA and keep `View Activities` as secondary. | ✅ No Theme Change |
| About content is centered and premium, but paragraph length reaches close to `980px` in `style.css:812-817`. | Long lines reduce readability even when centered. | Cap paragraphs at `72ch` and use `text-align: left` above 2 paragraphs if readability matters; keep heading centered. | ✅ No Theme Change |
| Units section has a strong network emblem, but the visual card and unit grid compete for attention. | Users may not know whether to scan the list or the emblem first. | Make the card copy shorter and put the “14 District Units” message as the dominant label; give the unit grid a stronger section label. | ✅ No Theme Change |
| Gallery filter bar works, but active state is color-only. | Users with color perception issues may miss the selected filter. | Add `aria-pressed`, a subtle check/dot, and persistent border/box-shadow on active filter. | ✅ No Theme Change |

### Typography Audit

Current stack: Playfair Display for hero/major headings, Inter for body/admin. This is a good premium fan-association pairing. Keep it.

| Current Issue | Why It Is A Problem | Fix Recommendation | Theme Impact |
|---|---|---|---|
| H1 uses very large clamps in `style.css:116-118` and separate mobile overrides in `style.css:2302-2306`, `style.css:2636-2638`. | The hero can swing between cinematic and cramped depending on viewport width. | Use a named type scale token and reserve the very large size for desktop only. | ✅ No Theme Change |
| Body copy is generally readable, but the about copy uses `line-height: 1.75` and centered alignment for long paragraphs. | Centered long-form text slows scanning. | Use `line-height: 1.65`, `max-width: 72ch`, and optional left alignment for multi-paragraph body text. | ✅ No Theme Change |
| Eyebrows use `font-weight: 900` and `letter-spacing: 0.12em` in `style.css:88-96`. | Strong but can become shouty across many sections. | Keep the style but reduce mobile letter spacing to `0.08em` and use consistent `12px` bottom margin. | ✅ No Theme Change |

Recommended type scale:

```css
:root {
  --font-display: "Playfair Display", Georgia, serif;
  --font-sans: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  --type-hero: clamp(3rem, 7.2vw, 6.65rem);
  --type-h1: clamp(2.5rem, 5.6vw, 4.75rem);
  --type-h2: clamp(2rem, 4.2vw, 3.75rem);
  --type-h3: clamp(1.25rem, 2vw, 1.5rem);
  --type-body-lg: clamp(1.05rem, 1.4vw, 1.18rem);
  --type-body: 1rem;
  --type-caption: 0.875rem;
  --leading-tight: 1.05;
  --leading-body: 1.65;
}
```

### Color System Audit

The current colors in `style.css:1-22` are brand-appropriate and mostly strong for dark-mode contrast. Do not replace them.

| Token | Current / Recommended Value |
|---|---|
| Primary | `--gold: #d4af37` |
| Primary Soft | `--gold-soft: #f2d675` |
| Primary Dark | `--gold-dark: #8b6f1f` |
| Secondary | `--green: #2f9b61` |
| Background | `--bg: #050505` |
| Background Soft | `--bg-soft: #080808` |
| Surface | `--card: #141414` |
| Surface Elevated | `--card-elevated: #181818` |
| Border | `--border: rgba(212, 175, 55, 0.25)` |
| Strong Border | `--border-strong: rgba(212, 175, 55, 0.48)` |
| Text Primary | `--text: #ffffff` |
| Text Secondary | `--muted: #cfcfcf` |
| Text Tertiary | `--muted-soft: #9f9f9f` |
| Success | Use existing `--green`, add `--success-bg: rgba(47,155,97,.16)` |
| Warning | Use existing `--gold`, add `--warning-bg: rgba(212,175,55,.16)` |
| Danger | Add `--danger: #ff6b6b` and `--danger-bg: rgba(255,107,107,.14)` |

| Current Issue | Why It Is A Problem | Fix Recommendation | Theme Impact |
|---|---|---|---|
| Status colors exist for pending/approved in `style.css:1859-1873`, but no danger/error tokens exist. | Future validation/error states will become ad hoc. | Add semantic aliases: `--success`, `--warning`, `--danger`, `--focus-ring`. Keep brand colors underneath. | ✅ No Theme Change |
| Low-opacity gold borders are beautiful but may be too subtle when they are the only state indicator. | Non-text contrast can fail for users with low vision. | Pair border changes with background, icon, text, or focus ring for all interactive states. | ✅ No Theme Change |
| No light mode is implemented. | Prompt asks for light/dark palettes, but current product is dark-only. | Keep dark mode as default. Document a future light palette only if theme switching is introduced later. | ⚠ Minor Theme Adjustment |

Future light palette, only if needed:

```css
[data-theme="light"] {
  --bg: #fbf7ea;
  --bg-soft: #f4edd8;
  --section: #fffaf0;
  --card: #ffffff;
  --card-elevated: #fff8e6;
  --text: #111111;
  --muted: #3f3f3f;
  --muted-soft: #666666;
  --border: rgba(139, 111, 31, 0.24);
}
```

### Spacing Audit

The project already uses `--section-pad` and `--gap`, but component padding is mostly hardcoded.

| Current Issue | Why It Is A Problem | Fix Recommendation | Theme Impact |
|---|---|---|---|
| Spacing uses many one-off values: `14px`, `18px`, `22px`, `26px`, `34px`, `58px`, `62px`, etc. across `style.css`. | Visual rhythm becomes hard to maintain across new sections. | Add spacing tokens and refactor over time to the 4/8 system. | ✅ No Theme Change |
| Mobile bottom CTA uses fixed body padding in `style.css:2272-2275`. | Can still overlap content on devices with safe-area insets. | Use `padding-bottom: calc(82px + env(safe-area-inset-bottom))` and same for the fixed bar. | ✅ No Theme Change |

Recommended spacing tokens:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
}
```

## Step 2 - Component Audit

| Component | Current Issue | Why It Is A Problem | Fix Recommendation | Theme Impact |
|---|---|---|---|---|
| Buttons | `.btn` has hover/active but no shared focus-visible state. | Keyboard users do not get equivalent affordance. | Add `.btn:focus-visible` ring and keep shimmer only on hover. | ✅ No Theme Change |
| Buttons | Primary CTA absent from hero. | Conversion hierarchy is muted. | Restore primary Join CTA. | ✅ No Theme Change |
| Inputs | Inputs use native validation but no helper text, autocomplete, or error UI. | Real forms will feel unfinished and harder to complete. | Add `autocomplete`, `inputmode`, helper/error text with `aria-describedby`. | ✅ No Theme Change |
| Forms | Success message uses `role="status"` in `index.html:272` and `index.html:302`, which is good, but it appears only after reset. | Users lose entered context immediately. | Show success first, then reset after a short delay or only reset on backend success. | ✅ No Theme Change |
| Dropdowns | Selects have basic styling but no disabled placeholder. | Users can submit the placeholder if validation is bypassed. | Use `<option value="" disabled selected>Select district</option>`. | ✅ No Theme Change |
| Modal | Dialog has `role="dialog"` and `aria-modal` in `index.html:340`, good foundation. Focus management missing. | Incomplete modal accessibility. | Add focus trap, restore focus, close function abstraction. | ✅ No Theme Change |
| Cards | Card hover pattern applies to many classes in `style.css:725-738`. | Non-clickable cards may look interactive. | Reserve lift hover for clickable cards; use softer glow for static content cards. | ✅ No Theme Change |
| Tables | Admin table in `admin.html:187-193` has headers but no caption/scope. | Screen readers lose table context. | Add `<caption>` and `scope="col"` on `th`. | ✅ No Theme Change |
| Navigation | Mobile nav overlay is visually strong but not focus-managed. | Keyboard and screen-reader flow weaker. | Add `aria-controls`, id, focus first link, close on outside click. | ✅ No Theme Change |
| Sidebar | Admin active nav is visual only in `script.js:236-246`. | Current page section is not announced. | Add `aria-current="page"` or `aria-current="true"` for active hash link. | ✅ No Theme Change |
| Header | Sticky header works, but anchor scroll can land sections under header. | Users may miss section headings after clicking nav. | Add `scroll-margin-top` to all sections. | ✅ No Theme Change |
| Footer | Footer is clean, but pending WhatsApp link repeats. | Duplicate dead link. | Same disabled/pending pattern or real channel URL. | ✅ No Theme Change |
| Tabs | No tabs currently. | N/A | If future admin modules use tabs, implement `role="tablist"` and arrow-key navigation. | ✅ No Theme Change |
| Accordions | No accordions currently. | N/A | Useful future pattern for district committee details on mobile. | ✅ No Theme Change |
| Tooltips | `title` is used for pending WhatsApp. | Browser tooltips are inconsistent and not touch-friendly. | Prefer visible pending label or disabled state. | ✅ No Theme Change |
| Toasts | No toast component; native alert is used. | Alerts break premium flow. | Add AKDFA toast with gold border and live region. | ✅ No Theme Change |
| Search | No search bar currently. | N/A | Admin will eventually need search for requests/content. Use a labelled input with clear button. | ✅ No Theme Change |
| Data Grids | Admin table is simple. | Fine for demo, limited for real admin. | Add table caption, sticky header, empty/loading/error rows for real data. | ✅ No Theme Change |
| Empty States | Committee modal has an empty state in `script.js:173`. | Good start, but generic. | Add action text: “Committee details will be updated soon by the unit admin.” | ✅ No Theme Change |
| Loading States | Page loader is branded, but blocks whole page. | Fine for demo; risky if it delays access. | Ensure loader never persists beyond 1.5s and respect reduced motion. | ✅ No Theme Change |
| Error States | No form error components exist. | Required for backend integration. | Add `.form-error`, `.field-error`, invalid border, and `aria-invalid`. | ✅ No Theme Change |

## Step 3 - Responsive Design Audit

| Breakpoint | Current Issue | Why It Is A Problem | Fix Recommendation | Theme Impact |
|---|---|---|---|---|
| 320-390px | Hero heading is controlled, but brand text truncates around `style.css:2549-2558` and `style.css:2632-2634`. | Header can feel cramped and lose identity. | Keep logo + “AKDFA” only under 390px; show registration in nav/menu, not header. | ✅ No Theme Change |
| 320-540px | District grid remains two columns in `style.css:2663-2666`. | District names like Thiruvananthapuram can become tight. | Use one column below 360px or reduce to compact pill style. | ✅ No Theme Change |
| 320-768px | Fixed mobile join bar can cover footer/content. | Last content may be hidden behind CTA. | Add safe-area padding and `scroll-padding-bottom`. | ✅ No Theme Change |
| 768-1024px | Admin sidebar becomes horizontal sticky nav in `style.css:2159-2186`. | Good pattern, but active state and scroll affordance are subtle. | Add fade edges and `aria-current`. | ✅ No Theme Change |
| 1024px+ | Admin cards use `repeat(7, minmax(120px, 1fr))` in `style.css:2020-2022`. | Seven cards become cramped on medium desktop. | Use `repeat(auto-fit, minmax(150px, 1fr))`. | ✅ No Theme Change |
| 1100px+ | Public nav font is reduced to `0.79rem` in `style.css:2046-2050`. | It fits, but can look less premium and harder to read. | Hide one low-priority link or use a “More” dropdown later; for now use `0.82rem` minimum. | ✅ No Theme Change |

## Step 4 - Accessibility Audit: WCAG 2.2 AA

| Issue | Impact | WCAG | Recommended Fix | Theme Impact |
|---|---|---|---|---|
| Missing global visible focus state | Keyboard users lose location | 2.4.7 Focus Visible, 2.4.11 Focus Appearance | Add global `:focus-visible` ring. | ✅ No Theme Change |
| Modal does not trap/restore focus | Keyboard and screen-reader users can interact behind modal | 2.1.1 Keyboard, 2.4.3 Focus Order | Implement focus trap and restore focus. | ✅ No Theme Change |
| Mobile menu lacks `aria-controls` and focus movement | Menu state is less clear | 4.1.2 Name, Role, Value | Add id/controls and focus behavior. | ✅ No Theme Change |
| Placeholder `href="#"` links | Creates dead keyboard stops | 2.4.4 Link Purpose | Use real link or disabled non-link element. | ✅ No Theme Change |
| Gallery filters do not expose pressed state | Screen readers cannot tell selected category | 4.1.2 Name, Role, Value | Toggle `aria-pressed="true/false"`. | ✅ No Theme Change |
| Forms lack autocomplete/inputmode | More effort, especially mobile | 1.3.5 Identify Input Purpose | Add `autocomplete="name"`, `tel`, `email`; `inputmode="tel"`. | ✅ No Theme Change |
| Table lacks caption and scoped headers | Table context is weaker | 1.3.1 Info and Relationships | Add `<caption>` and `scope="col"`. | ✅ No Theme Change |
| No skip link | Keyboard users must tab through header each load | 2.4.1 Bypass Blocks | Add visible-on-focus skip link to `main`. | ✅ No Theme Change |

Accessibility CSS:

```css
.skip-link {
  position: fixed;
  left: 16px;
  top: 12px;
  z-index: 1000;
  transform: translateY(-140%);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  padding: 10px 14px;
  color: #080808;
  background: var(--gold-soft);
  font-weight: 900;
}

.skip-link:focus-visible {
  transform: translateY(0);
}

:where(a, button, input, textarea, select, [tabindex]):focus-visible {
  outline: 2px solid var(--gold-soft);
  outline-offset: 3px;
  box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.18);
}
```

## Step 5 - Interaction Design Audit

| State | Current Issue | Why It Is A Problem | Fix Recommendation | Theme Impact |
|---|---|---|---|---|
| Hover | Strong and premium across cards/buttons. | Some static cards appear clickable. | Reduce hover lift on non-interactive cards. | ✅ No Theme Change |
| Active | Active scale exists in `style.css:2144-2149`. | Good, but only for some elements. | Include social icons, module cards, modal close. | ✅ No Theme Change |
| Focus | Missing globally. | Accessibility and polish issue. | Add focus-visible system. | ✅ No Theme Change |
| Disabled | No disabled component state. | Pending links and future admin actions need it. | Add `.is-disabled`, `[aria-disabled="true"]`. | ✅ No Theme Change |
| Loading | Page loader exists; buttons do not have loading state. | Future form submissions will need feedback. | Add `.btn.is-loading` spinner/dim state. | ✅ No Theme Change |
| Error | No error state. | Forms/admin workflows incomplete. | Add field-level error and summary pattern. | ✅ No Theme Change |
| Success | Form status exists. | Good start but visually quiet. | Add success icon/dot and keep message visible. | ✅ No Theme Change |

Toast replacement:

```html
<div class="toast-region" aria-live="polite" aria-atomic="true"></div>
```

```css
.toast-region {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 120;
  display: grid;
  gap: 10px;
}
.toast {
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  padding: 12px 14px;
  color: var(--gold-soft);
  background: rgba(8, 8, 8, 0.94);
  box-shadow: var(--shadow-soft);
  font-weight: 800;
}
```

## Step 6 - Design System Audit

Current maturity: **partially tokenized**. Colors, radius, container, gap, transition, and shadows exist. Typography, spacing, z-index, component states, semantic colors, and naming layers need structure.

Recommended CSS architecture:

```css
/* 1. Tokens */
:root { /* color, type, spacing, radius, shadow, z-index */ }

/* 2. Base */
html, body, img, a, button, input, textarea, select { }

/* 3. Accessibility */
.skip-link, :focus-visible, .sr-only { }

/* 4. Layout */
.section, .section-inner, .split-layout, .card-grid { }

/* 5. Components */
.btn, .card, .form-field, .modal, .toast, .nav, .badge { }

/* 6. Sections */
.hero, .about-layout, .units-section, .gallery-section { }

/* 7. Admin */
.admin-body, .admin-sidebar, .admin-panel { }

/* 8. Utilities */
.is-hidden, .is-disabled, .full, .reveal { }
```

| Current Issue | Why It Is A Problem | Fix Recommendation | Theme Impact |
|---|---|---|---|
| `style.css` is a large single file with public, admin, section, component, animation, and responsive CSS mixed together. | Future edits become risky and duplicate-prone. | Keep one file if desired, but reorganize by layers with comment headers. | ✅ No Theme Change |
| Card classes repeat visual rules across many selectors. | Hard to create consistent variants. | Introduce `.card`, `.card--interactive`, `.card--media`, `.card--stat`. | ✅ No Theme Change |
| Button variants exist but no disabled/loading/danger variants. | Admin and forms need more states. | Add `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn[disabled]`, `.btn.is-loading`. | ✅ No Theme Change |
| Radius uses one `--radius: 8px`, while mobile join uses `18px` and `14px`. | Radius system is inconsistent. | Add `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill`. | ✅ No Theme Change |

## Step 7 - Modern UI Scores

| Category | Score | Explanation |
|---|---:|---|
| Visual Design | 8.0 | Strong identity, cinematic hero, premium black/gold direction. Needs restraint in hover/static card treatment. |
| Usability | 7.0 | Clear sections and CTAs, but hero primary CTA is missing and placeholder links create friction. |
| Accessibility | 5.5 | Good semantic start, but focus, modal, skip link, and pressed states need work. |
| Responsiveness | 7.2 | Thoughtful breakpoints exist; small mobile and admin card density need refinement. |
| Consistency | 6.8 | Repeated card style is cohesive, but states/radius/spacing are inconsistent. |
| Typography | 7.4 | Good font pairing; heading/body measure needs tighter control. |
| Color System | 8.2 | Brand palette is strong and mostly contrast-safe; needs semantic aliases. |
| Component Quality | 6.4 | Good visual components, incomplete state model. |
| Design System Maturity | 5.6 | Tokens exist, but no full component/state/token architecture. |
| Overall Product Quality | 6.8 | Strong demo foundation; needs accessibility and system polish to feel premium-product grade. |

## Step 8 - Frontend Code Quality Review

| Current Issue | Why It Is A Problem | Fix Recommendation | Theme Impact |
|---|---|---|---|
| JavaScript builds district buttons dynamically in `script.js:149-158`, while special units are static in HTML. | Split source of truth can create mismatch. | Store all unit data in one object and render both district and special units, or keep all static. | ✅ No Theme Change |
| Modal close logic is repeated in click and keydown handlers in `script.js:189-207`. | Repetition increases bug risk. | Create `closeCommitteeModal()` and `openCommitteeModal()` with focus handling. | ✅ No Theme Change |
| `innerHTML` is used for committee content in `script.js:173-182`. | Current data is local and safe, but future admin data could become an XSS risk. | Build DOM nodes or sanitize backend data before insertion. | ✅ No Theme Change |
| Smooth scrolling is JS-driven in `script.js:84-94`. | It overrides user/browser behavior and may ignore reduced motion unless handled. | If `prefersReducedMotion`, use `behavior: "auto"`; also add `scroll-margin-top`. | ✅ No Theme Change |
| Admin demo buttons all show alert. | Feels unfinished and inconsistent with theme. | Route to toast/status; label demo behavior in context. | ✅ No Theme Change |

Improved modal JS shape:

```js
let lastFocusedElement = null;

const closeCommitteeModal = () => {
  modal?.classList.remove("is-open");
  modal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  lastFocusedElement?.focus();
};

const openCommitteeModal = (district) => {
  lastFocusedElement = document.activeElement;
  // existing content update
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  modal.querySelector(".modal-close")?.focus();
};
```

Improved form field pattern:

```html
<label for="memberMobile">Mobile Number</label>
<input
  id="memberMobile"
  name="mobile"
  type="tel"
  autocomplete="tel"
  inputmode="tel"
  required
  aria-describedby="memberMobileHint"
  placeholder="Mobile number">
<small id="memberMobileHint" class="field-hint">Use the number connected to WhatsApp if possible.</small>
```

## Step 9 - Premium Product Benchmarking

| Benchmark | Gap | Exact Improvement Needed | Theme Impact |
|---|---|---|---|
| Apple | Motion and visual effects are beautiful but not always restraint-led. | Reduce motion where it does not clarify state; make focus and transitions feel intentional. | ✅ No Theme Change |
| Google | Accessibility state coverage is incomplete. | Add focus, pressed, disabled, error, loading, live-region patterns. | ✅ No Theme Change |
| Stripe | Component system is not yet structured enough. | Convert repeated card/button/form styles into reusable variants. | ✅ No Theme Change |
| Linear | Navigation and admin states need sharper interaction feedback. | Add active/current state semantics and cleaner admin density. | ✅ No Theme Change |
| Notion | Content readability can improve. | Keep visual drama in hero; make long content calm, readable, and scannable. | ✅ No Theme Change |
| Airbnb | Forms and empty states need more human guidance. | Add helper text, friendly validation, and meaningful empty states. | ✅ No Theme Change |

## Step 10 - UI Modernization Plan

### Phase 1 - Critical Accessibility and Interaction

| Current Issue | Why It Is A Problem | Fix Recommendation | Theme Impact |
|---|---|---|---|
| Missing focus system | Blocks keyboard polish | Add global focus-visible CSS | ✅ No Theme Change |
| Modal focus incomplete | WCAG risk | Add focus trap/restore | ✅ No Theme Change |
| Placeholder links | Dead interactions | Replace with disabled state or real URL | ✅ No Theme Change |
| Alerts | Low-quality interaction | Add themed toast | ✅ No Theme Change |
| Gallery filters lack ARIA pressed | Screen reader state unclear | Add `aria-pressed` updates | ✅ No Theme Change |

### Phase 2 - Layout and Typography Polish

| Current Issue | Why It Is A Problem | Fix Recommendation | Theme Impact |
|---|---|---|---|
| Aggressive global word wrapping | Breaks headings | Remove from headings, use body-only wrapping | ✅ No Theme Change |
| Long centered paragraphs | Lower readability | Cap to `72ch`, use calmer line-height | ✅ No Theme Change |
| Admin cards cramped at desktop | Lower scan quality | Use auto-fit grid | ✅ No Theme Change |
| Mobile CTA safe area missing | Possible overlap | Add safe-area padding | ✅ No Theme Change |

### Phase 3 - Design System Organization

| Current Issue | Why It Is A Problem | Fix Recommendation | Theme Impact |
|---|---|---|---|
| Hardcoded spacing | Inconsistent rhythm | Add spacing tokens | ✅ No Theme Change |
| One radius token | Inconsistent corners | Add radius scale | ✅ No Theme Change |
| Repeated card selectors | Hard to maintain | Create card variants | ✅ No Theme Change |
| Missing semantic colors | Future states inconsistent | Add success/warning/danger aliases | ✅ No Theme Change |

## Implementation Checklist

1. Add skip link and `id="main"` to `<main>`.
2. Add global `:focus-visible` CSS.
3. Replace `href="#"` pending WhatsApp links with disabled non-links or a real URL.
4. Add `aria-controls="primaryNavigation"` and `id="primaryNavigation"` to mobile nav.
5. Focus first nav link when menu opens; close on outside click.
6. Add `scroll-margin-top: 88px` to sections and major anchors.
7. Add modal focus trap and restore focus.
8. Replace `alert()` with toast/live region.
9. Add `aria-pressed` to gallery filter buttons.
10. Add autocomplete/inputmode and `aria-describedby` to forms.
11. Add table caption and scoped headers.
12. Reorganize CSS into token/base/accessibility/layout/component/section/admin layers.

## Code Snippet: Low-Risk CSS Patch

```css
:root {
  --focus-ring: 0 0 0 4px rgba(212, 175, 55, 0.18);
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 18px;
  --radius-pill: 999px;
}

main section,
.admin-topbar,
.admin-panel {
  scroll-margin-top: 88px;
}

h1,
h2,
h3 {
  overflow-wrap: normal;
}

p,
li,
small,
span {
  overflow-wrap: break-word;
}

:where(a, button, input, textarea, select, [tabindex]):focus-visible {
  outline: 2px solid var(--gold-soft);
  outline-offset: 3px;
  box-shadow: var(--focus-ring);
}

[aria-disabled="true"],
.is-disabled {
  opacity: 0.52;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  body {
    padding-bottom: calc(82px + env(safe-area-inset-bottom));
  }

  .mobile-join-bar {
    bottom: calc(12px + env(safe-area-inset-bottom));
  }
}
```

## Final Recommendation

Keep the AKDFA look: black stadium atmosphere, gold prestige, green Dhoni energy, glass cards, and bold serif hero typography. The product does not need a redesign. It needs a professionalization pass: accessibility states, cleaner component architecture, stronger form behavior, safer modal/nav interactions, and tighter spacing/typography tokens.

The final result should feel exactly like the current product, just sharper, calmer, easier to use, and more trustworthy.
