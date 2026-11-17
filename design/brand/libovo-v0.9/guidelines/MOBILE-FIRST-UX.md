# Libovo / Mobile-first UI rules

## Prioritize the top tasks

At phone widths (320, 360, 375, 390, 430 CSS px) the three most frequent actions should never be buried under unrelated content: (1) see today / upcoming bookings, (2) create or manage a booking, (3) find a customer / contact.

- One primary CTA per screen. Keep labels literal: `Ny bokning`, `Sök kund`, `Skicka påminnelse`.
- On mobile favor bottom navigation with **max 4 primary destinations plus Mer**, or an equally accessible alternative; make it adaptive to app workflows, not aesthetic habit.
- Touch targets **44×44 CSS px** minimum target goal, 8px between nearby touch targets; meet WCAG 2.2 target sizes and focus requirements.
- 16px body text; numeric data monospaced/tabular digits; avoid fields that force browser auto-zoom.
- Important actions should not need long-press, hover, swipe-only gestures or buried overflow menus.
- Show a clear back path, save/error states, sync freshness, and drafts when a workflow might be interrupted.
- Only use sticky buttons when they do not cover content, safe-area and mobile keyboards; implement `env(safe-area-inset-bottom)` carefully.
- Large tables become action-oriented cards or horizontally scroll in a clearly signposted region; do not truncate customer names/time labels without full accessible names.
- Calendar mobile is a day timeline with staff filter and fast next-day controls; wide desktop may use staff columns/day/week.
- Booking flow: treatment → suggested times → personal details → review/confirm. Price, duration, staff and timezone always visible before confirmation.
- Progress disclosure: ask for data only when needed. No account creation barrier unless necessary. Provide visible consent/control for AI and outreach.
- AI entry point: contextual secondary action. Proactive suggestion must show why, what it will do, and require confirmation for externally visible actions.
- Mobile-first responsive design is for web/PWA now, not a promise of a native app.

## Breakpoints for testing (not rigid layout rules)

320, 360, 390, 430, 768, 1024, 1440 CSS px. Test zoom at 200%, portrait/landscape, light/dark, validation errors, empty/loading states, very long names and Swedish date/currency formats.

## Definition of done

- No sideways page overflow (except intentionally scrollable tables with cue).
- Keyboard navigation works on web desktop and touch only on mobile.
- Contrast: normal text >=4.5:1, nontext controls and chart meaning >=3:1, visible focus. Avoid color-only signals. Check against *real background* and disabled states.
- No duplicated primary actions or permanent giant AI box at the top of every page.
- Default user can complete a simple new booking with no irrelevant distractions.
