# Libovo brand v0.9 – frontend audit (before)

Date: 2026-11-17. Branch `design/libovo-brand-v09`. Screens in
[`before/`](before/) (320, 390, 768, 1440 px, light and dark, viewport height,
device scale 1). Brand kit: `design/brand/libovo-v0.9/` (read-only).

## 1. Architecture

- Next.js 16 app router, React 19, Tailwind 3.4, lucide icons. No component
  library; the studio's own primitives live in `src/concept/ui/` (button,
  card/section, badge, controls: segmented/chip/switch/fields, sheet, toast,
  empty state, avatar, charts).
- Platform shell: `/studio/**` (owner/staff studio, client state in
  localStorage), `/` (two-track lab, DB backed), `/product`, `/live`,
  `/landing` (pages router), `/admin` login (older admin, out of scope except
  its look).
- Tenant pages: `/boka/[slug]` (+ `/widget`, `/gift`, `/me`, `/booking/[id]`)
  render inside `PageRoot` (`.booking-theme`) which writes the tenant palette
  as CSS variables (goal 17).
- i18n: every studio string in `src/concept/i18n/en.ts`; product name from
  `src/concept/brand.ts` (enforced by `tests/brand.test.ts`).

## 2. Design system and tokens

- Colours are `--eko-*` RGB channels set on `.studio-root` in
  `src/app/studio/studio.css`, exposed to Tailwind as `eko-*`
  (`tailwind.config.ts`). **The token family is named after the demo tenant**
  (Salong Eko), ≈ 960 class uses in 146 files. The studio is therefore styled
  in the tenant's green, which is exactly what the white-label guideline
  forbids in the other direction.
- Two staff colours are hard-wired by staff id (`eko-anna`, `eko-erik`).
- No `success` or `info` token: confirmations borrow the accent (green), so
  "brand" and "OK" are the same colour. No input-border or focus token; inputs
  use the 1px `line` colour (≈ 1.3:1 against the surface – fails non-text
  contrast).
- Scattered hex: avatar pastel palette (8 pairs, light only – glows in dark
  mode), theme-controls fallback, campaign poster (tenant artwork, fine).
- Radii: `rounded-xl` (12) 75×, `rounded-2xl` (16) 55×, `rounded-3xl` (24) 4×,
  plus pill everywhere for chips, tabs and the floating button. Visibly
  over-rounded against the kit's 4/6/10/14.
- Shadows on every card (`shadow-card`) plus a ring; cards are both outlined and
  lifted.

## 3. Typography

- `font-family: Inter, …` is declared but **Inter is never loaded**; users see
  the system font (SF / Segoe / DejaVu) – the screenshots show DejaVu-like
  fallback on Linux. No tabular numbers for times and money.
- Body is mostly `text-sm` (14 px, 339×) and `text-[15px]`; 11–13 px labels
  are common (`text-xs` 122×, `text-[11px]` 16×). Below the kit's 16 px body.
- Inputs are 15 px: iOS zooms the page on focus.
- Section titles are 13 px uppercase tracking – fine as overlines, but used for
  every section, competing with content.

## 4. Theme

- Dark mode exists only via `prefers-color-scheme`; no user control, no
  `data-theme`, no persistence. `color-scheme` only set on `.studio-root`.
- `themeColor` in the viewport metadata uses the old greens.
- Dark palette is the green family; the primary "Book again" button in dark
  is a pale mint block (fine contrast, but reads as disabled).

## 5. Mobile navigation and layout

- Bottom tabs (Today, Calendar, Customers, Inbox, More) – right structure,
  44 px+ targets, safe-area padding. Keep.
- The **floating "Ask Flerdo" pill sits over content** on every phone page:
  it covers list rows (customers, inbox, More), the Today brief, and on the
  booking page editor it collides with the sticky Save bar (both visible at
  390 px). Content padding (9 rem) only helps at the very bottom.
- The top row on phones spends a full row on demo controls (Owner/Staff
  switch, Help) before the page title.
- Breakpoints in use: `sm` (640) 83×, `lg` (1024) 58×, `md` 6×. Sidebar from
  `lg`; between 640 and 1023 the phone layout is stretched (768 shots show
  one-column Today with wide cards).

## 6. Product areas

| Area | Observations |
|---|---|
| Today | Phone order is wrong for the top task: stats → morning brief (6 rows) → needs moving → next customer → suggestions → **today's schedule last** (`order-last`). Two large stat cards ("Earned today SEK 0", "Free slots") carry little. Primary button "Someone is calling" is fine as the single primary. |
| Calendar | Phone shows both staff columns side by side at 320 px (names truncated "Medical foot …"); a day timeline with staff filter is what the kit asks for. Next/prev day exists. Desktop columns OK. |
| Customers | Search first, filter chips scroll horizontally (cut-off chip "Not se…" with no cue). Rows are good (avatar, name, status, next visit). Names can truncate without full accessible name in places (`truncate` without title). |
| Customer card | Good actions (Book again, Call, Text). Large AI summary box with sparkle icon at top; acceptable as contextual. Several boxed cards stacked. |
| Inbox | Clear rows, unread dots. Filter tabs overflow at 320. |
| More | Long list of cards with icon tiles – fine, but tiles add noise. |
| Booking page editor | Phone Edit/Preview toggle good; sticky Save bar overlaps the floating assistant button and content. |
| Settings | Key/value rows; no theme control. |
| Public booking | Treatment → time → details steps with progress; price/duration visible on slot cards. Default tenant look = the studio's green (product look), not neutral. |
| AI | `PageHeader` renders a permanent "Ask Flerdo… what would you like to do?" command box on **every** studio page from 640 px, plus a header button, plus the floating pill on phones – three entries to the same capability. |

## 7. White-label

- Tenant layer (`themeVariables`) writes the same `--eko-*` variables the
  studio uses; the "default" palette means "the product's look". After a
  rebrand that would put Libovo plum on Salong Eko's page – the boundary must
  become explicit: tenant tokens on `.booking-theme`, a neutral default, and
  semantic success/warning/danger/info never overridable.
- Tenant pages share `studio.css` and `.studio-root`; any studio-level change
  leaks into them unless the tenant layer re-declares everything it owns.

## 8. Tests

- Unit (vitest, ~80 files) incl. `brand.test.ts`, page theme/colour tests.
- e2e `tests/concept-e2e/*` (Playwright, 390 and 1280): journeys, assistant,
  customer experience, booking page with axe checks. Two specs use the
  "Command box" textbox; they need the new entry (panel / Ctrl+K).

## 9. Regression risks

- Codemod of ≈ 960 class names: risk of missed dynamic names
  (`` `bg-eko-${x}` ``) and of opacity modifiers (`/70`) with non-RGB tokens.
- Tenant theme must keep working for all palettes and owner CSS.
- Removing the inline command box must not lose: rule + AI interpretation,
  proposals with Approve, clarify choices, answers, Undo, voice.
- Radius scale change touches `.booking-theme[data-corners]` rules.
- `brand.test.ts` pins the old name; the assistant label must stay "Ask Flerdo".

## 10. The brand kit itself (critical notes)

- Its own mobile preview (`preview/libovo-390-light.png`) lets the **bottom
  nav cover content** – do not copy.
- The preview hero is a big plum decorative card with two buttons of equal
  weight ("Se bokningsflödet" / "Visa principerna") – competing CTAs; the kit's
  own rules say one primary.
- Stat boxes "Bokningar 12 / Lediga tider 3" are the decorative cards the owner
  wants fewer of.
- `libovo.tokens.css` has no `prefers-color-scheme` fallback; with `:root`
  defaulting to light, a no-JS or first paint is always light. Its
  `[data-tenant]` example sets a green `--tenant-accent` globally for any
  tenant – a demo rule, not product code.
- `--ui-input-border` vs surface is 4.13:1 (light) – passes non-text 3:1 only;
  no subtle "selected" tint token is defined (needed for selected chips/nav).
- Dark action is apricot with dark text: correct, but disabled states and
  focus rings on apricot need checking on real components.
- Icons are temporary `lv` monograms (the kit says so); wordmark kerning is
  unreviewed at small sizes.

## 11. Keep / improve / simplify / remove

| Decision | Item |
|---|---|
| Keep | Bottom tabs 4 + More; sidebar on desktop; `Sheet` on native `<dialog>`; toasts with Undo; i18n dictionary and the single brand constant; tenant `PageRoot` layer and palette contrast nudging; assistant panel (full screen on phone, side panel on desktop) and its approve/undo cards; "Ask Flerdo" label (pending decision). |
| Improve | Tokens → kit semantics (`bg`, `surface`, `text`, `action`, `success`…); load Inter with tabular numbers; 16 px body and inputs; input borders with real contrast; focus ring token; theme control (light/dark/system) persisted; Today order (schedule first); phone calendar as one-staff day timeline with filter; neutral default tenant look; sticky bars that never cover content. |
| Simplify | Radii to 4/6/10/14; cards outlined, no shadow; avatars neutral instead of 8 pastels; Today stats into one compact row; More list without icon tiles' extra fills; section overlines lighter. |
| Remove | Inline command box on every page (moves into the panel, opened by the header button or Ctrl/Cmd+K); duplicated studio greens as product colour; `eko-*` naming; leaf mark as product logo in the studio sidebar (Salong Eko stays as business name, Libovo wordmark for the platform). |
