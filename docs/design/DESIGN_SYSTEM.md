# Studio design system

A salon owner should be able to scan a screen, understand the next step and recover from a mistake. Use familiar salon language and make the common path simple by default. Give each screen one primary action. Use motion to explain what changed, never to decorate.

The implementation lives in `src/concept/ui`. Open `/studio/_gallery` in a development build to try the controls with real focus, pointer, loading, disabled and error states. Appearance switches the whole gallery between light, dark and system. All labels, hints, errors, action verbs and accessible names come from the English and Swedish concept dictionaries.

## Tokens

Use the runtime variables in `brand-theme.css` or their Tailwind utilities. Theme pairs follow the existing platform colour scheme. Booking pages own their tenant palette. The brand kit is the reference for platform colours and radii.

| Role | Runtime scale | Tailwind examples |
| --- | --- | --- |
| Spacing | `--space-{1,2,3,4,6,8}` = 4, 8, 12, 16, 24, 32 px | `gap-2`, `p-4`, `lg:px-8` |
| Type | `--type-{h1,h2,h3,body,meta,min}` = 28, 20, 16, 15, 13, 12 px at the default root size. Relative units respect text zoom. | `text-h1`, `text-h2`, `text-h3`, `text-body`, `text-meta`, `text-minimum` |
| Radius | `--radius-{xs,sm,md,lg,pill}` = 4, 6, 10, 14, 999 px | `rounded-md` controls, `rounded-lg` cards, `rounded-full` chips |
| Elevation | Flat by default. `--elevation-raised` for a floating surface, `--elevation-sheet` for sheets and toasts. Shadows adapt to the theme. | `shadow-raised`, `shadow-sheet` |
| Layer | `--z-sticky` 10, `--z-popover` 40, `--z-toast` 50. Native modal dialogs use the browser top layer. | `z-sticky`, `z-popover`, `z-toast` |
| Motion | `--dur-1` 120 ms, `--dur-2` 200 ms, `--dur-3` 280 ms. Enter with `--ease-out` cubic-bezier(.2,.8,.2,1). Exit with `--ease-in` cubic-bezier(.4,0,1,1). | `duration-quick`, `duration-normal`, `duration-slow`, `ease-enter`, `ease-exit` |
| Colour | Use ground, surface, text, secondary text, input border, action, on-action, focus and semantic pairs. Hairlines are decorative. | `bg-surface`, `text-text-secondary`, `ring-input-border` |
| Target | `--touch-target` 44 px minimum on both axes. Rows have a 56 px minimum height. | `min-h-target min-w-target`, `min-h-14` |

## Component guide

| Component | When to use | Do | Don't |
| --- | --- | --- | --- |
| Button / ButtonLink | Commit a change or navigate to the next step | Lead with a verb. Use primary, secondary, tertiary or danger. Use the link for navigation. Loading preserves the name and disables repeat submission. | Put two competing filled actions on one screen. |
| IconButton | A familiar compact action such as Close | Supply a translated label and keep the 44 px target in every variant. | Rely on the icon or tooltip to name an unfamiliar action. |
| SegmentedControl | Choose exactly one view or filter | Keep labels short. Use the selected tab stop and arrow keys. Let a long group scroll horizontally inside its own track. | Wrap segments onto another line. |
| ChoiceCards | Choose one of a few answers in a setup question | Use a short noun per card in a two- or three-column grid. Arrow keys move the choice. | Use it for a view switch or for more than about eight options. |
| Switch | A setting that takes effect immediately | Name the setting and expose its checked state. Explain an unavailable setting nearby. | Make a switch appear operable when nothing happens. |
| Chip / Tag | Toggle a filter / identify a category | Use Chip for a pressed state and optional count. Use Tag for a static category. | Present a static label as a button. |
| Badge / DemoBadge | Name a status or identify simulated activity | Pair an icon and a word. Put DemoBadge beside simulated sending or charging. The studio header carries one; use `short` where space is tight. | Convey risk by colour alone or imply live delivery. |
| Field / Input / Select / Textarea | Collect one value | Put the visible label above the control. Add a hint and an actionable inline error. Use native date and time inputs. | Use a placeholder as the only label or erase invalid input. |
| PageHeader | Introduce a screen | Provide a back link on a detail page, one title, an optional short subtitle and one primary action. Studio pages use the adapter that includes Help. | Build a separate mobile header or hide the only action in a toolbar. |
| ListRow | Open an item or its details | Put the identity in the title, context in 13 px meta and a supporting mark at either end. The entire row is one link or button. Use optional enter/exit motion for a changed row and remove it in `onExited`. | Nest another button or link in the row. |
| StickyActionBar | Keep an action reachable while a form or preview scrolls | Put the content in `children` and the controls in `actions`. Set `--action-layout-height` to the available height inside existing chrome. The grid reserves the footer's actual height including wrapped text and the bottom safe area. | Estimate a fixed footer height or cover the last field. |
| Card / Section | Group related content | Use a heading for a section and a single surface for related rows. | Put a card inside every row. |
| EmptyState | Explain a genuinely empty result | Use one icon, one sentence and one recovery action such as clearing a filter. | Show a blank card, multiple competing actions or a loading skeleton for empty data. |
| Sheet / ConfirmDialog | Edit a focused task or confirm a consequential change | Keep a mounted sheet controlled by `open` through exit. Use a title, a specific verb and a way to cancel. Escape and the close button return focus to the opener. | Use an alert for routine information or unmount the sheet mid-transition. |
| ConsentSheet | Ask for access at the moment it is needed | Summarise who wants access and why, list each grant, and supply a specific verb. High-risk access needs a fresh, unticked acknowledgement on every opening. The caller handles confirmation. | Pre-check consent, hide a grant or use this UI as a stored authorisation. |
| Toast / Toaster | Briefly confirm a completed action | Mount one Toaster per surface. Use `showToast(message, { label, run })` for Undo. Keep persistent failures with their support reference. | Put the only copy of a required instruction in a transient message. |
| Notice | Show information or feedback in context | Use text and the tone's icon. Reserve alert announcements for errors that need immediate attention. | Use a warning colour for ordinary help. |
| Skeleton / SuccessCheck | Reserve space during loading or confirm completion | Match the final geometry and show an accessible loading label. Use the check once when a task succeeds. | Keep an empty state pulsing or replay success on every render. |
| Tabs / Menu | Switch panels / disclose related navigation | Name the tab list and each panel. Arrows, Home and End navigate tabs. Use native disclosure links for the menu. | Hide the primary task inside navigation. |
| Avatar / StaffAvatar / Wordmark | Identify a person or the platform | Use a name with initials or a staff photo and a named destination on linked marks. | Use staff colours as the only identification. |
| Stat / Charts | Explain a measurement or compare periods | Name the measure, format the unit, and use text and outlined or dashed shapes for comparisons. ColumnChart, BarList, PairedColumns, CompareBars and Meter share the theme. | Make the reader decode a colour-only legend. |

Existing imports including `Segmented`, `TextInput`, `TextArea`, the `ghost` button variant and the studio PageHeader continue to work.

## Layout and motion

- Use 16 px phone gutters and 32 px desktop gutters. Stack the title, description, choices and fields in reading order. Let long labels increase row height.
- Use one scrollport for the content beside a persistent action bar. Give the scrollport an accessible label. On phones include the bottom safe area and allow actions to wrap. Keep keyboard focus in view.
- Pair press scale (.97) with a tint. Move the segmented thumb and switch knob with transforms. Slide and fade sheets and toasts, entering more slowly than exiting. Reveal the check through a transformed clip. Use transform and opacity for motion. Keep layout, colour and shadow changes immediate.
- With reduced motion, remove travel, continuous pulsing, repeated animation and smooth scrolling. Preserve a brief opacity-only transition for entering or leaving overlays. Preserve final selection, loading and success cues.

## Settings and Advanced

- Settings is an overview of at most six sections, each a `ListRow` that opens its own page with a back link to Settings. Only a section as small as Appearance sits in place. Modules never add a section; their settings live on their own pages. `SETTINGS_SECTIONS` in `src/concept/studio/nav.ts` is the list, and the complexity-budget test holds it to six.
- Advanced is one quiet row at the end of More and of Settings. It holds what a salon can run without: developer details, embed code and own domain, booking language, SMS price, own CSS, rooms, support access, pack switching and the demo reset. Move something there rather than delete it, and keep its old address working.
- Primary screens use salon words: "Your booking link", "Download my data", "History and undo". Technical words (MCP, API, CSV, slug, localhost, token, UTC, CSS, iframe, SIE) are allowed only under the dictionary prefixes listed in `tests/concept-jargon.test.ts`.

## Accessibility and performance

Target WCAG 2.2 AA. Use a visible focus ring and native activation, labelling, modal focus management and disabled semantics. Text and secondary text need at least 4.5:1 contrast. Large text and meaningful graphical boundaries need at least 3:1. Maintain 44 × 44 px targets, check 200 % zoom and reflow at 320 px. Check both languages, both themes and keyboard-only operation.

Budget at most **2 KB gzipped per component** and **5 KB per feature** of incremental client code. Reuse shared primitives and icons. A new runtime dependency requires an architecture decision record (ADR). Measure representative owner interactions on mobile, with **INP < 200 ms** and **CLS < 0.05**. The gallery axe spec checks both themes and the consent dialog and attaches screenshots. Timing, zoom and touch ergonomics still need review on real screens.

## UI review checklist

- [ ] One filled primary per screen.
- [ ] Targets ≥ 44 px at 390 px.
- [ ] Text ≥ 12 px, secondary contrast ≥ 4.5:1.
- [ ] Spacing only from tokens, gutters 16/32.
- [ ] Shared PageHeader.
- [ ] No horizontal page scroll, nothing hidden by bars.
- [ ] Shared components.
- [ ] Never colour alone.
- [ ] No jargon (MCP, API, CSV, slug, localhost, token, UTC, CSS, iframe, SIE) in primary views; Advanced only.
- [ ] Demo label on anything simulated.
- [ ] Standard empty states.
- [ ] Long, empty and dark cases checked on mobile and desktop.

ESLint warns on native controls outside the kit and gallery, literal hex colours inside TSX className/style, and arbitrary Tailwind sizes. Run `npm run lint` to see each location. Resolve warnings as each screen adopts the shared components.

The foundation baseline is 314 warnings across application TSX: 185 raw controls, 125 arbitrary sizes and 4 hex colours.
