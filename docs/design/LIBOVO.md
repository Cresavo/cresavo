# Design system (frontend guide)

Written for the Libovo kit v0.9; the product is now Cresavo and the tokens come
from `design/brand/cresavo-v0.1/`. The structure below still applies.

Brand kit: `design/brand/libovo-v0.9/` (read-only, provisional, not
trademark-cleared). This file says how the kit lives in the code. Audit and
before/after: [AUDIT.md](AUDIT.md), [COMPARISON.md](COMPARISON.md).

## 1. Tokens

One source: `src/concept/ui/brand-theme.css`, imported once in
`src/app/layout.tsx` (and `src/pages/_app.tsx` for the pages router). Values
are the kit's, 1:1; each colour is a `light-dark()` pair.
`tests/concept-tokens.test.ts` checks every value against the kit's
`tokens/colors.json` and fails on any runtime token that is neither in the
kit nor a listed extension (`action-bg`, `staff-1/2(-bg)`, `chart-compare`).
Plain values for browser chrome and the manifest (`THEME_COLORS`) are read
from the same JSON, not copied.

| Tailwind name | CSS variable | Use |
|---|---|---|
| `bg` | `--ui-bg` | Page background |
| `surface` | `--ui-surface` | Cards, sheets, bars, inputs |
| `surface-2` | `--ui-surface-2` | Quiet fills: segmented tracks, selected nav item, disabled controls, avatars |
| `text` | `--ui-text` | Body text and headings |
| `text-secondary` | `--ui-text-secondary` | Meta text, labels, icons. Never on `action-bg` |
| `border` | `--ui-border` | Dividers and card outlines (decorative) |
| `input-border` | `--ui-input-border` | Anything you interact with: inputs, secondary buttons, unchecked switch (≥ 3:1) |
| `action` / `action-hover` / `on-action` | `--ui-action`, `--ui-action-hover`, `--ui-action-text` | The one primary button, links, active chip ring, charts |
| `action-bg` | `--ui-action-bg` | Selected tint (chips, tab icon, highlights). Text on it is `text` |
| `focus` | `--ui-focus` | Focus rings only |
| `success`, `warning`, `danger`, `info` (+ `-bg`) | `--ui-…` | Meaning only. Never brand plum/apricot; tenants cannot change them |
| `staff-1`, `staff-2` (+ `-bg`) | `--ui-staff-…` | Staff identity in calendars (not in the kit); always next to the name |
| `chart-compare` | `--ui-chart-compare` | The period before in charts (not in the kit): ≥ 3:1, always outlined or dashed |

Opacity modifiers work (`bg-surface/80`): Tailwind wraps the variable in
`color-mix()`. Radii: `rounded-xs` 4, `rounded-sm` 6 (small parts),
`rounded-md` 10 (buttons, inputs, rows), `rounded-lg` 14 (cards, sheets),
`rounded-full` only for chips, badges, dots and avatars. Cards are outlined
(`ring-1 ring-border`), not lifted; `shadow-sheet` is for things that float.
No new hex values in components; a colour that is not a token is a design
decision for this file.

## 2. Theme

- `<html data-theme="light|dark|system">`, set before first paint by
  `THEME_SCRIPT` (`src/concept/ui/theme.ts`), saved in `localStorage["ui-theme"]`
  (try/catch, default `system`). CSS pins `color-scheme` for light and dark;
  system follows the OS. Controls: Settings > Appearance, the sidebar
  (desktop), More (phones) – `ThemeControl` in `src/concept/ui/theme-control.tsx`.
- Browser chrome: the root layout's `theme-color` tags follow the OS; a pinned
  light or dark choice adds a `theme-color` pin ahead of them (`pinThemeColor`,
  from `THEME_SCRIPT` before first paint and from `ThemeControl`). Tenant pages
  never get the studio's pin: they pin the palette's background or fall back
  to their neutral tags.
- **Rule:** never set `color-scheme` inline. Next compiles `light-dark()` into
  switches that only CSS rules with `color-scheme` turn on; a scope with its
  own scheme must also re-declare the tokens it uses (see the tenant layer).

## 3. Typography

Inter via `next/font/google` (400/500/600/700, latin + latin-ext, swap), as
`--font-inter` → `--font-ui`. Tabular numbers across the studio. Scale: page
title 26/28 px semibold; section title 17 px semibold (sentence case, no
uppercase overlines); body and inputs 16 px (`text-base`; inputs never below
16 px, iOS zooms); secondary 14–15 px; badges 12 px.

## 4. Components (`src/concept/ui/`)

| Component | When |
|---|---|
| `Button` primary | The one main action of a screen. Everything else is `secondary` (outlined with `input-border`), `ghost` or `danger` |
| `Button` sizes | All ≥ 44 px tall; `sm` only narrows padding |
| `IconButton` | 44 × 44, always with a label (also the tooltip) |
| `Field`, `TextInput`, `TextArea`, `Select`, `SearchInput` | Forms; 16 px, `input-border`, focus ring |
| `Segmented` | 2–5 mutually exclusive views (radios). Wraps when narrow |
| `Chip` | Filters and multi-choice; pill; selected = `action-bg` + action ring |
| `Switch` | On/off settings |
| `Badge` | Status: `neutral`, `accent` (ours/new), `success`, `info`, `warn`, `danger` |
| `Card`, `Section` | Grouping with a real purpose; no decorative cards |
| `Sheet` | Dialogs: bottom sheet on phones, centred from 640 px |
| `showToast` | Short confirmations, optional Undo; sits above the tab bar and the assistant button |
| `EmptyState` | Empty lists, with the next action |
| `Avatar` | Neutral initials |
| `Wordmark` | The product mark (`inverse` = kit white variant on a fixed plum surface) |
| `ThemeControl` | Theme choice; `compact` in the shell |

Loading: the studio shows the pulsing wordmark until the browser state is
read; lists use `EmptyState`; errors use toasts with what to do next.

## 5. Layout and breakpoints

Test at 320, 360, 390, 430, 768, 1024, 1440. `sm` (640): tablet layout, top
bar Ask button, sheets become dialogs. `lg` (1024): sidebar (wordmark, business
name, nav, theme control, user) and multi-column pages. Content max 6xl
(1152 px) inside the shell.

## 6. Mobile rules

- Bottom tabs: Today, Calendar, Customers, Inbox + More; safe-area padding.
- Sticky and floating things never cover the last item: `main` reserves room
  for the tab bar and the assistant button; sticky bars (page editor) sit above
  the assistant button.
- No sideways page scroll; chips and segmented controls wrap. The day strip in
  the public time picker is the one deliberate horizontal scroller.
- Calendar on phones: one person's day, staff switch visible, fast prev/next.
- Booking flows show treatment, duration, staff, price and time next to the
  confirm button.

## 7. AI entry

- No assistant box on pages. Entry points: **Ask Flerdo** secondary button in
  the top bar (tablet and up, with `Ctrl K` / `⌘K` hint), the floating button
  with microphone on phones, and Ctrl/Cmd+K anywhere in the studio.
- Quick commands are typed in the panel; rules answer at once and, with an AI
  key, the model's reading replaces the card while the owner has not acted.
- Contextual suggestions stay where they help (Today brief and suggestions,
  inbox drafts). Changes are proposals with Approve; Undo on the card.

## 8. White-label boundary

- Platform (Libovo tokens): studio, landing, login (`/admin`), product, live,
  platform settings, consent.
- Tenant (`src/concept/booking/tenant-theme.css`, root `.booking-theme`):
  `/boka/<slug>` and its widget, gift card, my bookings pages. The route
  boundary (`.booking-boundary` on the `/boka` layout and `/unknown-address`)
  puts the neutral tenant tokens on the whole document, so the canvas, an
  unknown slug and error states never show platform colours. These routes
  replace the platform's install metadata (`TENANT_METADATA`: no manifest,
  no application name, a neutral calendar icon in `public/tenant/`, or the
  business's logo once the page has loaded). The embed code is titled "Book
  with <business>"; platform attribution appears only if
  `TENANT_POLICY.attribution` (in `src/concept/brand.ts`) is switched on, and
  it is off. It re-declares
  every non-semantic token, follows the visitor's OS (never the studio's
  choice), and defaults to neutral ink/white. A palette arrives as inline
  `--ui-*` variables plus `data-scheme`. Semantic tokens are declared on
  `.booking-theme` too, so they resolve in the tenant's scheme; the owner's CSS
  cannot redefine them (`src/concept/page/css.ts`). Semantic messages use
  `Notice` (`src/concept/ui/notice.tsx`) on their paired background, and
  everything with `data-tone` is protected in `tenant-theme.css`. The owner's
  CSS may paint colour only on branding slots (root, headings, links,
  buttons, header, footer, nav, sections, images; no opacity or filter on
  containers).
- Salong Eko keeps its green as the explicit palette `forest`.

## 9. Naming and rename-back

- Product name: `BRAND.name` in `src/concept/brand.ts`; assistant label:
  `ASSISTANT.name` ("Assistant"). `tests/brand.test.ts` fails if either is
  spelled out elsewhere in `src`. Help articles use `{brand}` / `{assistant}`.
- The desktop studio sidebar uses `public/brand/studio-wordmark.svg` at 124 px.
  Other wordmark placements use `src/concept/ui/wordmark.tsx`.
- `src/concept/ui/brand-assets.ts` points the platform metadata and web app
  manifest to `public/favicon.ico` and `public/brand/icon-*.png`.
- Unchanged on purpose: domains, env vars, package name, API routes, MCP
  namespaces, localStorage keys, Prisma identifiers, file names such as
  `docs/design/LIBOVO.md` are internal.
- To rename: change `BRAND.name` (and tagline), replace the wordmark paths and
  the icon files. Nothing else.

## 10. Sidebar and app artwork

The [selected artwork](../../design/concepts/logo-v3-codex/selected-inter-regular/)
provides the Inter Regular sidebar lettering and the white lowercase c on
aubergine for the favicon, Apple touch icon and installed web app in both themes.

## 11. Pending decisions

- **Assistant name** (owner): keep "Ask Flerdo" or rename. One edit in
  `ASSISTANT`.
- Salong Eko's palette is fixed light (the old product look also had a dark
  variant); a tenant dark palette would be a new page-theme feature.

## 12. Deviations from the brand kit (and why)

| Kit | Code | Why |
|---|---|---|
| `[data-theme]` selectors, light by default | `light-dark()` pairs, system by default | One declaration per token; no-JS and first paint follow the OS |
| No selected-tint token | `--ui-action-bg` (10 % action into surface) | Selected chips/nav need a quiet state that is not a second primary |
| No staff colours | `--ui-staff-1/2` | Calendars need two identities that are neither brand nor semantic |
| No chart comparison colour | `--ui-chart-compare` | The previous-period series needs ≥ 3:1 without competing with the primary |
| `[data-tenant] --tenant-accent` example | Full tenant token layer on `.booking-theme` | The example would leak a global accent; tenants need bg/text/accent with contrast nudging (goal 17) |
| Preview: bottom nav over content | Reserved space, sticky bars above floating button | Kit's own MOBILE-FIRST rule |
| Preview: big plum hero with two equal CTAs, stat boxes | Not used in the product | One primary per screen; fewer decorative cards |
| Kit preview labels in Swedish | English UI via `en.ts` | AGENTS.md i18n rule; maps 1:1 later |
| Tabular numbers for numeric data | Tabular numbers studio-wide | Simpler, consistent alignment; Inter reads well either way |
| Chips "small" (12 px) | Chips 44 px tall, 15 px | Touch-target rule wins |

## 13. Verification

- axe: zero violations on all studio pages, the public booking pages and the
  platform pages (`/`, `/product`, `/live`, `/admin`, `/landing`), light and dark, 390 and 1280 (`tests/concept-e2e/theme.spec.ts`
  covers the main set).
- Contrast on computed styles (studio and tenant scope, both themes): primary
  10.66 light / 9.37 dark, input border 4.13 / 5.02, focus ring 3.49 / 10.89,
  secondary on surface-2 (also disabled) 4.83 / 6.99; tenant Salong Eko primary
  7.49, input border 4.43. All pairs pass (text ≥ 4.5, non-text ≥ 3).
