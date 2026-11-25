# Studio design system

A salon owner should be able to scan a screen, understand the next step and recover from a mistake. Use familiar salon language and make the common path simple by default. Give each screen one primary action. Use motion to explain what changed, never to decorate.

The implementation lives in `src/concept/ui`. Open `/studio/_gallery` in a development build to try the controls with real focus, pointer, loading, disabled and error states. Appearance switches the whole gallery between light, dark and system. All labels, hints, errors, action verbs and accessible names come from the English and Swedish concept dictionaries.

## Tokens

Use the runtime variables in `brand-theme.css` or their Tailwind utilities. Theme pairs follow the existing platform colour scheme. Booking pages own their tenant palette. The brand kit is the reference for platform colours and radii.

| Role | Runtime scale | Tailwind examples |
| --- | --- | --- |
| Spacing | `--space-{1,2,3,4,5,6,8,12}` = 4, 8, 12, 16, 20, 24, 32, 48 px | `gap-2`, `p-4`, `lg:px-8` |
| Type | `--type-{h1,h2,h3,body,meta,min}` = 28, 20, 16, 15, 13, 12 px at the default root size. Relative units respect text zoom. | `text-h1`, `text-h2`, `text-h3`, `text-body`, `text-meta`, `text-minimum` |
| Radius | `--radius-{xs,sm,md,lg,pill}` = 4, 6, 10, 14, 999 px | `rounded-md` controls, `rounded-lg` cards, `rounded-full` chips |
| Elevation | Flat by default; a screen's one raised card uses the studio's soft card shadow (`.studio-raised`). `--elevation-raised` for a floating surface, `--elevation-sheet` for sheets and toasts. Shadows adapt to the theme. | `shadow-raised`, `shadow-sheet` |
| Layer | `--z-sticky` 10, `--z-popover` 40, `--z-toast` 50. Native modal dialogs use the browser top layer. | `z-sticky`, `z-popover`, `z-toast` |
| Motion | `--dur-1` 120 ms, `--dur-2` 200 ms, `--dur-3` 280 ms. Enter with `--ease-out` cubic-bezier(.2,.8,.2,1). Exit with `--ease-in` cubic-bezier(.4,0,1,1). | `duration-quick`, `duration-normal`, `duration-slow`, `ease-enter`, `ease-exit` |
| Colour | Use ground, surface, text, secondary text, input border, action, on-action, focus and semantic pairs. Hairlines are decorative. | `bg-surface`, `text-text-secondary`, `ring-input-border` |
| Target | `--touch-target` 44 px minimum on both axes. Rows have a 56 px minimum height. | `min-h-target min-w-target`, `min-h-14` |

## Component guide

| Component | When to use | Do | Don't |
| --- | --- | --- | --- |
| Button / ButtonLink | Commit a change or navigate to the next step | Lead with a verb. Use primary, secondary, tertiary, link or danger. The primary is a filled pill; a secondary is a neutral tint with no outline. `link` is an underlined word for a quiet action in running text or a list. Use the link for navigation. Loading preserves the name and disables repeat submission. | Put two competing filled actions on one screen. |
| IconButton | A familiar compact action such as Close | Supply a translated label and keep the 44 px target in every variant. | Rely on the icon or tooltip to name an unfamiliar action. |
| SegmentedControl | Choose exactly one view or filter | Keep labels short. Use the selected tab stop and arrow keys. Let a long group scroll horizontally inside its own track. The selected segment is an outlined thumb with stronger text. Use `fit` for a row of collection filters so each sizes to its label, and `quiet` for a utility such as the theme switch (bare icons, a short line under the chosen one). | Wrap segments onto another line, or fill the selected segment with the action colour. |
| ChoiceCards | Choose one of a few answers in a setup question | Use a short noun per card in a two- or three-column grid. Arrow keys move the choice. | Use it for a view switch or for more than about eight options. |
| Switch | A setting that takes effect immediately | Name the setting and expose its checked state. Explain an unavailable setting nearby. | Make a switch appear operable when nothing happens. |
| Chip / Tag | Toggle a filter / identify a category | Use Chip for a pressed state and optional count. Use Tag for a static category. | Present a static label as a button. |
| Badge / DemoBadge | Name a status or identify simulated activity | Pair an icon and a word. Put DemoBadge beside simulated sending or charging, at the moment it happens; use `short` where space is tight. The studio shell carries none. | Convey risk by colour alone or imply live delivery. |
| Field / Input / Select / Textarea | Collect one value | Put the visible label above the control. Add a hint and an actionable inline error. Use native date and time inputs. | Use a placeholder as the only label or erase invalid input. |
| PageHeader | Introduce a screen | Provide a back link on a detail page, one title, an optional short subtitle and one primary action. Studio pages use the adapter that includes Help. | Build a separate mobile header or hide the only action in a toolbar. |
| ListRow | Open an item or its details | Put the identity in the title, context in 13 px meta and a supporting mark at either end. The entire row is one link or button. Use optional enter/exit motion for a changed row and remove it in `onExited`. | Nest another button or link in the row. |
| StickyActionBar | Keep an action reachable while a form or preview scrolls | Put the content in `children` and the controls in `actions`. Set `--action-layout-height` to the available height inside existing chrome. The grid reserves the footer's actual height including wrapped text and the bottom safe area. | Estimate a fixed footer height or cover the last field. |
| Card / Section | Group related content | Use a heading for a section. Group with spacing first. `Card` has three surfaces: `paper` (the default, a plain surface with no outline, for lists and forms), `raised` (the one thing a screen is about, lifted with a soft shadow) and `flat` (content straight on the canvas, no box and no rules). Raise at most one surface per screen. See "No nested boxes" in [SITE_RULES](SITE_RULES.md). | Put a card inside a card or around every row, or outline a card. |
| EmptyState | Explain a genuinely empty result | Use one icon, one sentence and one recovery action such as clearing a filter. It has no frame and no icon plate; when the page already says why (a closed day), use one status row instead. | Show a blank card, multiple competing actions or a loading skeleton for empty data. |
| Sheet / ConfirmDialog | Edit a focused task or confirm a consequential change | Keep a mounted sheet controlled by `open` through exit. Use a title, a specific verb and a way to cancel. Escape and the close button return focus to the opener. | Use an alert for routine information or unmount the sheet mid-transition. |
| MediaDialog | Expand a recording with native media controls | Mount on demand, supply a titled, focusable media element and remove the dialog in `onClose`. Give Close a translated label. | Use a sheet for full-size video or build custom playback controls for the expanded recording. |
| ConsentSheet | Ask for access at the moment it is needed | Summarise who wants access and why, list each grant, and supply a specific verb. High-risk access needs a fresh, unticked acknowledgement on every opening. The caller handles confirmation. | Pre-check consent, hide a grant or use this UI as a stored authorisation. |
| Toast / Toaster | Briefly confirm a completed action | Mount one Toaster per surface. Use `showToast(message, { label, run })` for Undo. Keep persistent failures with their support reference. | Put the only copy of a required instruction in a transient message. |
| Notice | Show information or feedback in context | Use text and the tone's icon. Reserve alert announcements for errors that need immediate attention. | Use a warning colour for ordinary help. |
| Skeleton / SuccessCheck | Reserve space during loading or confirm completion | Match the final geometry: `SkeletonRow`, `SkeletonCard`, `SkeletonText`, `SkeletonColumn` or `Bone` inside one `SkeletonGroup`, which carries the loading label. Use the check once when a task succeeds. | Keep an empty state pulsing, use a skeleton for empty data or replay success on every render. |
| StatusDot | Show that a wait named in text is still going | Put it before the sentence: `progress` (a filling ring) while something is being done, `wait` (a slow dot) while waiting on someone else. It takes the text's colour and holds still with reduced motion. | Use it without the sentence, in an accent colour, or in a grid of indicators. |
| Popover / ActionMenu | Offer a few actions or secondary controls from one button | Use `ActionMenu` for a short list of actions (role menu, arrow keys) and `Popover` for a few controls. The panel grows from the button and folds back into it; Escape and a choice return focus. `sheetOnPhone` uses the bottom sheet below `sm` for controls. | Put a form, long copy or a confirmation in it; use a Sheet for those. |
| Tabs / Menu | Switch panels / disclose related navigation | Name the tab list and each panel. Arrows, Home and End navigate tabs. Use native disclosure links for the menu. | Hide the primary task inside navigation. |
| Avatar / StaffAvatar / Wordmark | Identify a person or the platform | Use a name with initials or a staff photo and a named destination on linked marks. | Use staff colours as the only identification. |
| Stat / Charts | Explain a measurement or compare periods | Name the measure, format the unit, and use text and outlined or dashed shapes for comparisons. ColumnChart, BarList, PairedColumns, CompareBars and Meter share the theme. | Make the reader decode a colour-only legend. |

Existing imports including `Segmented`, `TextInput`, `TextArea`, the `ghost` button variant and the studio PageHeader continue to work.

Use `Button` with `align="start"` for a left-aligned label and `align="between"` for a label and trailing mark. `SegmentedControl` options can include a count as part of the visible and accessible label. A `ListRow` can show formatted title or meta content and can render static information with neither an `href` nor an `onClick`. Add separate controls outside an interactive row.

Use `Checkbox` for a native checkbox with a full-height label target, and `Input type="color"` for a native colour picker. The `Textarea` composer variant sits inside a group that provides a visible focus ring. A side `Sheet` fills the screen on phones and docks on desktop. Its content owns the scrollport when a composer or footer needs to stay visible. Use `headerActions` for secondary tools alongside Close. Provide a `PageHeader` title ref when a step change needs to focus the heading.

Use `Input type="radio"` with a full-height label for native form choices. `Input type="hidden"` can carry values for a non-JavaScript form submission. `SearchInput` accepts an `endAction` for a labelled submit icon. Use `Switch showLabel` when the setting name and track form one visible control. Use a `SegmentedControl` option's `content` to display stacked information such as the day, date and availability. Its `label` should read the same information in order.

## Layout and motion

- Use 16 px phone gutters and 32 px desktop gutters. Stack the title, description, choices and fields in reading order. Let long labels increase row height.
- Left-align studio forms and form-like flows in the page column. Apply `md:max-w-form` to the form surface to cap it at 40rem (640 px) from `md` up. Lists, cards and data tables can use the full page column. Use `max-w-reading` (70ch) for running text.
- Use `width` on `Field` to size the label, control and feedback together, or on a standalone `Input` or `Select`. Use `date` (14rem) for dates and times, `number` (10rem) for numbers, currency and percentages, and `short` (24rem) for names, phone numbers and other short values. The default `full` suits long text. These caps start at `md`. Stack fields when the viewport is too narrow for a row.
- Use `width="responsive"` on form actions built with `Button` or `ButtonLink`. They use the available width below `sm` and fit their labels from `sm` up. Put the primary action on the form's left edge or in a right-aligned action row. The `StickyActionBar` footer aligns actions to the right on desktop.
- Keep step tabs and segmented controls at their natural width. Allow step rows and chip groups to wrap, and let a segmented control scroll within its own width when its options need more room. Each chip sizes to its label.
- In booking checkout, place the price and policy summary above confirmation on narrow screens and in a sticky side column when the layout has room. Treatment rows use a tenant-accent Book button alongside the service details.
- Reserve at least 96 px plus the bottom safe area below Studio content on phones. Keep Calendar's navigation and view controls on one toolbar row and use the options sheet for secondary controls.
- Use one scrollport for the content beside a persistent action bar. Give the scrollport an accessible label. On phones include the bottom safe area and allow actions to wrap. Keep keyboard focus in view.
- Pair press scale (.97) with a tint. Move the segmented thumb, the phone tab bar's selection mark and the switch knob with transforms. Grow a popover from its trigger (`transform-origin` on the trigger's side) and fold it back the same way. Slide and fade sheets and toasts, entering more slowly than exiting. Reveal the check through a transformed clip. Use transform and opacity for motion. Keep layout, colour and shadow changes immediate.
- With reduced motion, remove travel, continuous pulsing, repeated animation and smooth scrolling. Preserve a brief opacity-only transition for entering or leaving overlays. Preserve final selection, loading and success cues.

## Settings and Advanced

- Settings is an overview of at most six sections, each a `ListRow` that opens its own page with a back link to Settings. Only a section as small as Appearance sits in place. Modules never add a section; their settings live on their own pages. `SETTINGS_SECTIONS` in `src/concept/studio/nav.ts` is the list, and the complexity-budget test holds it to six.
- Advanced is one quiet row at the end of More and of Settings. It holds developer details, embed code and own domain, booking language, SMS price, own CSS, rooms, support access, pack switching, the staff preview and the demo reset. Keep old addresses working when moving a feature. Give staff preview a way back to the owner view in the page content.
- Primary screens use salon words: "Your booking link", "Download my data", "History and undo". Technical words (MCP, API, CSV, slug, localhost, token, UTC, CSS, iframe, SIE) are allowed only under the dictionary prefixes listed in `tests/concept-jargon.test.ts`.
- Lead with the number owners come to Finance for and put the period comparison next to it. Group accountant downloads in one sheet that names the dates, what each file includes and how the accountant can open it.
- Use one More entry with tabs for gift cards and packages. Put review moderation and replies in the Inbox, with the Reviews filter available while the add-on is on.

## Accessibility and performance

Target WCAG 2.2 AA. Use a visible focus ring and native activation, labelling, modal focus management and disabled semantics. Text and secondary text need at least 4.5:1 contrast. Large text and meaningful graphical boundaries need at least 3:1. Maintain 44 × 44 px targets, check 200 % zoom and reflow at 320 px. Check both languages, both themes and keyboard-only operation.

Budget at most **2 KB gzipped per component** and **5 KB per feature** of incremental client code. Reuse shared primitives and icons. A new runtime dependency requires an architecture decision record (ADR). Measure representative owner interactions on mobile, with **INP < 200 ms** and **CLS < 0.05**. The gallery axe spec checks both themes and the consent dialog and attaches screenshots. Timing, zoom and touch ergonomics still need review on real screens.

## UI review checklist

- [ ] One filled primary per screen.
- [ ] No nested boxes: at most one level of surface, no card in a card.
- [ ] Targets ≥ 44 px at 390 px.
- [ ] Text ≥ 12 px, secondary contrast ≥ 4.5:1.
- [ ] Spacing only from tokens, gutters 16/32.
- [ ] Shared PageHeader.
- [ ] No horizontal page scroll, nothing hidden by bars.
- [ ] Shared components.
- [ ] Never colour alone.
- [ ] No jargon (MCP, API, CSV, slug, localhost, token, UTC, CSS, iframe, SIE) in primary views; Advanced only.
- [ ] Demo label beside a simulated send or charge, not as a standing disclaimer.
- [ ] Standard empty states.
- [ ] Long, empty and dark cases checked on mobile and desktop.

ESLint warns on native controls outside the kit and gallery, literal hex colours inside TSX className/style, and arbitrary Tailwind sizes. Run `npm run lint` to see each location. Resolve warnings as each screen adopts the shared components.

The foundation baseline is 314 warnings across application TSX: 185 raw controls, 125 arbitrary sizes and 4 hex colours.

## Plum and paper (studio direction, November 2026)

- The sidebar and the phone masthead are a plum surface (`.studio-chrome` in `studio.css`), the deepest ground in dark. The scope re-declares the tokens its contents read, so shared controls inside it need no variants. The phone status bar follows it (`studioChrome` in `ui/theme.ts`). The selected sidebar row is a faint white wash (`--studio-nav-selected`) with white text and a 6 px radius; hover is the same wash, weaker. Apricot in the sidebar is for the Inbox count only, never the selection.
- The canvas is paper. Content sits on it without frames or rules; rows inside one list keep a hairline only where the rows vary enough to need it (Customers, Inbox).
- Page titles are larger in the studio than the kit's app scale (about 30 px on a phone, 36 px wide), set on `.studio-root`; the kit token is unchanged.
- Apricot is a highlight fill with dark ink (`.studio-highlight`), used for counts. Never apricot text on a light ground, and not on passive facts such as a time.
- On phones a plus in the masthead opens Quick actions: New booking, Find a customer, Someone is calling, Ask the assistant.
- An export button becomes "Open file" after the download.
- Review rule: no centred-everything layouts, no rows of identical cards, no icons on plates, no dotted "A · B · C" strings where separate facts read better, no arrows appended to links.
