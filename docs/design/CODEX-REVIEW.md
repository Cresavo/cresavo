# Codex adversarial review · design/libovo-brand-v09

Read-only review by Codex (GPT, ChatGPT login) of the branch against origin/concept/ai-native-demo, run 2026-11-17 on the head before the phase E QA fixes. Verbatim output below.

## Verdict

Request changes before merging. The rebrand discards saved demo state and traps phone users in Staff view. Consolidating commands into the assistant panel is consistent with the brand kit, but the replacement needs to preserve proposal review, undo, and voice attribution. The neutral tenant theme is a sound default. Its current boundary stops at the booking content wrapper, leaving gaps in public branding and contrast.

## High

1. **The rebrand discards saved bookings and tenant configuration.** [generate.ts:30](../../src/concept/data/generate.ts:30) · [store.ts:29](../../src/concept/store.ts:29)  
   The branch bumps `DEMO_VERSION` from 14 to 15. The store accepts only the current version, so even a same-day v14 save falls back to fresh fixtures. Existing bookings, customer edits, stock changes, and saved booking-page designs disappear from the active state. Keep v14 compatible if the shape is unchanged, or migrate it in place. Seed Forest only for new Salong Eko fixtures and add a test that loads a v14 save with edits.

2. **Phone and tablet users can switch to Staff but cannot switch back.** [shell.tsx:55](../../src/concept/studio/shell.tsx:55) · [shell.tsx:144](../../src/concept/studio/shell.tsx:144) · [More page:45](../../src/app/studio/more/page.tsx:45) · [access.ts:23](../../src/concept/ops/access.ts:23)  
   Below `lg`, the role switch moved into More. Staff cannot open More, and the shell removes the tab immediately after the switch. The role persists, so reloading at the same width leaves the user locked out of the owner workflows. Put the demo switch in a shell control reachable from both roles and test the round trip at 390 px.

## Medium

3. **A late model response can replace a proposal the owner is already reviewing.** [use-assistant.ts:59](../../src/concept/studio/assistant/use-assistant.ts:59) · [use-assistant.ts:103](../../src/concept/studio/assistant/use-assistant.ts:103) · [thread-store.ts:91](../../src/concept/studio/assistant/thread-store.ts:91)  
   Refinement checks only the reply’s status. Picking an ambiguity option updates the card without setting a status, so a late response can overwrite the owner’s choice. The panel also saves the rules interpretation’s context and replaces only the displayed reply. A follow-up such as “that day” can therefore resolve to a different date from the one shown on the model’s card. Mark refinement as pending, discard it after a choice or approval, and commit the accepted reply and its context together while that turn is current.

4. **Undo can report success after the store rejects it.** [use-assistant.ts:98](../../src/concept/studio/assistant/use-assistant.ts:98) · [undo.ts:5](../../src/concept/log/undo.ts:5)  
   The panel marks the reply `undone` and clears its Undo action regardless of whether dispatch succeeds. A later edit to the same booking, or eviction of the original log entry, can make the undo unavailable. This already affected panel replies and now affects every quick command. Use `isUndoable` to decide whether to offer the action and update the card only after a successful dispatch.

5. **The panel loses command editing and voice provenance.** [assistant-panel.tsx:49](../../src/concept/studio/assistant/assistant-panel.tsx:49) · [reply-card.tsx:60](../../src/concept/studio/assistant/reply-card.tsx:60) · [use-assistant.ts:94](../../src/concept/studio/assistant/use-assistant.ts:94)  
   The old inline box could restore the original request for editing and logged approved typed and spoken commands separately. The panel clears the composer, offers Approve and Not now, and records both input paths as `assistant`. Restore an Edit action that repopulates the composer and invalidates the old proposal. Carry input provenance with the proposal through approval so the activity log can distinguish voice from typed commands.

6. **Public booking still inherits platform branding outside the tenant wrapper.** [booking layout:22](../../src/app/boka/%5Bslug%5D/layout.tsx:22) · [studio.css:5](../../src/app/studio/studio.css:5) · [booking shell:29](../../src/concept/booking/shell.tsx:29) · [root layout:18](../../src/app/layout.tsx:18) · [manifest.ts:5](../../src/app/manifest.ts:5)  
   An unknown slug returns before `PageRoot`, so its card uses the platform action colors. The outer page and body also use platform backgrounds. Public routes inherit the Libovo application name and root icons, and the root manifest starts at `/studio`. The design notes acknowledge the favicon gap. Apply the neutral tenant scope at the public route boundary, including error states and the outer background, and scope platform install metadata to platform routes.

7. **Tenant CSS can still repaint semantic states, and ordinary palette settings can make them unreadable.** [page/css.ts:16](../../src/concept/page/css.ts:16) · [page/css.ts:104](../../src/concept/page/css.ts:104) · [review-form.tsx:35](../../src/concept/booking/review-form.tsx:35) · [colour.ts:121](../../src/concept/page/colour.ts:121)  
   The sanitizer blocks semantic variable declarations but still permits direct foreground and background styling on the same elements. Separately, the review error draws the fixed danger foreground directly on the tenant background. An allowed `#717171` background produces about **1.49:1** against the light danger text, and the editor’s contrast report never checks that pair. Restrict custom color styling to approved branding slots and render semantic messages on their paired semantic backgrounds.

8. **Browser chrome follows the OS even when the studio is pinned to the opposite theme.** [root layout:27](../../src/app/layout.tsx:27) · [theme-control.tsx:11](../../src/concept/ui/theme-control.tsx:11) · [theme.spec.ts:47](../../tests/concept-e2e/theme.spec.ts:47)  
   The saved preference changes `data-theme`, while both `theme-color` tags use only OS media queries. A dark studio on a light OS therefore requests light browser chrome. The first-paint test checks the attribute at document `interactive` and does not observe the first rendered frame. Apply the resolved studio theme to the chrome from the boot script and theme control, preserve independent tenant chrome, and test a reload with opposing OS and saved settings.

9. **The public shell opts into edge-to-edge rendering without protecting its navigation from cutouts.** [booking layout:11](../../src/app/boka/%5Bslug%5D/layout.tsx:11) · [booking shell:34](../../src/concept/booking/shell.tsx:34)  
   The route sets `viewportFit: "cover"`, but the public header uses fixed horizontal padding and no top safe-area inset. The salon link and My bookings can sit in the cutout area. Apply the top and horizontal insets to the public header and check the booking shell in portrait and landscape.

## Low

10. **The chart tint falls below the kit’s contrast target.** [charts.tsx:22](../../src/concept/ui/charts.tsx:22) · [charts.tsx:89](../../src/concept/ui/charts.tsx:89)  
    The previous-period series uses the action color at 25%. On the kit’s light and dark surfaces, the composited bars measure about **1.57:1** and **1.76:1** respectively, below the 3:1 target for meaningful graphics. The selected tint is reasonable for navigation, where labels convey state. Give chart series a separate tested color and a second cue such as a pattern or outline.

11. **Several high-use controls miss the kit’s 44 px target.** [controls.tsx:27](../../src/concept/ui/controls.tsx:27) · [controls.tsx:69](../../src/concept/ui/controls.tsx:69) · [assistant-panel.tsx:140](../../src/concept/studio/assistant/assistant-panel.tsx:140)  
    Segmented controls and assistant composer buttons specify 40 px targets, and the shared switch button itself is 28 px high. These controls are used for calendar filters, settings, and voice. Preserve the compact visual treatment inside 44 px interactive areas.

12. **The checked-in kit and runtime CSS are separate sources for the same values.** [kit tokens:2](../../design/brand/libovo-v0.9/tokens/libovo.tokens.css:2) · [runtime tokens:12](../../src/concept/ui/libovo-theme.css:12) · [brand-assets.ts:4](../../src/concept/ui/brand-assets.ts:4)  
    The runtime `light-dark()` representation is a defensible deviation. The existing development CSS shows that Next emits the expected scheme switches. The runtime palette is still a manual copy of the kit, with another copy of the chrome colors in TypeScript. Generate those values from the kit JSON or add a parity test. Keep the documented staff colors and selected-state tint as explicit runtime extensions.

The diff shows no rebrand rename of an existing storage key, environment variable, API route, or MCP namespace. The MCP proposal card retains its approval callbacks, and the stock and finance diffs retain their mutation paths. `git diff --check` passed, and the working tree stayed clean.

## What I could not verify

I did not run browser journeys, a fresh production build, or live model, microphone, or MCP interactions. I could not verify first-frame paint, iOS keyboard and zoom behavior, or rendered overflow and sticky-bar overlap at 320 px. The findings above come from source inspection, existing compiled development CSS, and contrast calculations.
tokens used
121,153
## Verdict

Request changes before merging. The rebrand discards saved demo state and traps phone users in Staff view. Consolidating commands into the assistant panel is consistent with the brand kit, but the replacement needs to preserve proposal review, undo, and voice attribution. The neutral tenant theme is a sound default. Its current boundary stops at the booking content wrapper, leaving gaps in public branding and contrast.

## High

1. **The rebrand discards saved bookings and tenant configuration.** [generate.ts:30](../../src/concept/data/generate.ts:30) · [store.ts:29](../../src/concept/store.ts:29)  
   The branch bumps `DEMO_VERSION` from 14 to 15. The store accepts only the current version, so even a same-day v14 save falls back to fresh fixtures. Existing bookings, customer edits, stock changes, and saved booking-page designs disappear from the active state. Keep v14 compatible if the shape is unchanged, or migrate it in place. Seed Forest only for new Salong Eko fixtures and add a test that loads a v14 save with edits.

2. **Phone and tablet users can switch to Staff but cannot switch back.** [shell.tsx:55](../../src/concept/studio/shell.tsx:55) · [shell.tsx:144](../../src/concept/studio/shell.tsx:144) · [More page:45](../../src/app/studio/more/page.tsx:45) · [access.ts:23](../../src/concept/ops/access.ts:23)  
   Below `lg`, the role switch moved into More. Staff cannot open More, and the shell removes the tab immediately after the switch. The role persists, so reloading at the same width leaves the user locked out of the owner workflows. Put the demo switch in a shell control reachable from both roles and test the round trip at 390 px.

## Medium

3. **A late model response can replace a proposal the owner is already reviewing.** [use-assistant.ts:59](../../src/concept/studio/assistant/use-assistant.ts:59) · [use-assistant.ts:103](../../src/concept/studio/assistant/use-assistant.ts:103) · [thread-store.ts:91](../../src/concept/studio/assistant/thread-store.ts:91)  
   Refinement checks only the reply’s status. Picking an ambiguity option updates the card without setting a status, so a late response can overwrite the owner’s choice. The panel also saves the rules interpretation’s context and replaces only the displayed reply. A follow-up such as “that day” can therefore resolve to a different date from the one shown on the model’s card. Mark refinement as pending, discard it after a choice or approval, and commit the accepted reply and its context together while that turn is current.

4. **Undo can report success after the store rejects it.** [use-assistant.ts:98](../../src/concept/studio/assistant/use-assistant.ts:98) · [undo.ts:5](../../src/concept/log/undo.ts:5)  
   The panel marks the reply `undone` and clears its Undo action regardless of whether dispatch succeeds. A later edit to the same booking, or eviction of the original log entry, can make the undo unavailable. This already affected panel replies and now affects every quick command. Use `isUndoable` to decide whether to offer the action and update the card only after a successful dispatch.

5. **The panel loses command editing and voice provenance.** [assistant-panel.tsx:49](../../src/concept/studio/assistant/assistant-panel.tsx:49) · [reply-card.tsx:60](../../src/concept/studio/assistant/reply-card.tsx:60) · [use-assistant.ts:94](../../src/concept/studio/assistant/use-assistant.ts:94)  
   The old inline box could restore the original request for editing and logged approved typed and spoken commands separately. The panel clears the composer, offers Approve and Not now, and records both input paths as `assistant`. Restore an Edit action that repopulates the composer and invalidates the old proposal. Carry input provenance with the proposal through approval so the activity log can distinguish voice from typed commands.

6. **Public booking still inherits platform branding outside the tenant wrapper.** [booking layout:22](../../src/app/boka/%5Bslug%5D/layout.tsx:22) · [studio.css:5](../../src/app/studio/studio.css:5) · [booking shell:29](../../src/concept/booking/shell.tsx:29) · [root layout:18](../../src/app/layout.tsx:18) · [manifest.ts:5](../../src/app/manifest.ts:5)  
   An unknown slug returns before `PageRoot`, so its card uses the platform action colors. The outer page and body also use platform backgrounds. Public routes inherit the Libovo application name and root icons, and the root manifest starts at `/studio`. The design notes acknowledge the favicon gap. Apply the neutral tenant scope at the public route boundary, including error states and the outer background, and scope platform install metadata to platform routes.

7. **Tenant CSS can still repaint semantic states, and ordinary palette settings can make them unreadable.** [page/css.ts:16](../../src/concept/page/css.ts:16) · [page/css.ts:104](../../src/concept/page/css.ts:104) · [review-form.tsx:35](../../src/concept/booking/review-form.tsx:35) · [colour.ts:121](../../src/concept/page/colour.ts:121)  
   The sanitizer blocks semantic variable declarations but still permits direct foreground and background styling on the same elements. Separately, the review error draws the fixed danger foreground directly on the tenant background. An allowed `#717171` background produces about **1.49:1** against the light danger text, and the editor’s contrast report never checks that pair. Restrict custom color styling to approved branding slots and render semantic messages on their paired semantic backgrounds.

8. **Browser chrome follows the OS even when the studio is pinned to the opposite theme.** [root layout:27](../../src/app/layout.tsx:27) · [theme-control.tsx:11](../../src/concept/ui/theme-control.tsx:11) · [theme.spec.ts:47](../../tests/concept-e2e/theme.spec.ts:47)  
   The saved preference changes `data-theme`, while both `theme-color` tags use only OS media queries. A dark studio on a light OS therefore requests light browser chrome. The first-paint test checks the attribute at document `interactive` and does not observe the first rendered frame. Apply the resolved studio theme to the chrome from the boot script and theme control, preserve independent tenant chrome, and test a reload with opposing OS and saved settings.

9. **The public shell opts into edge-to-edge rendering without protecting its navigation from cutouts.** [booking layout:11](../../src/app/boka/%5Bslug%5D/layout.tsx:11) · [booking shell:34](../../src/concept/booking/shell.tsx:34)  
   The route sets `viewportFit: "cover"`, but the public header uses fixed horizontal padding and no top safe-area inset. The salon link and My bookings can sit in the cutout area. Apply the top and horizontal insets to the public header and check the booking shell in portrait and landscape.

## Low

10. **The chart tint falls below the kit’s contrast target.** [charts.tsx:22](../../src/concept/ui/charts.tsx:22) · [charts.tsx:89](../../src/concept/ui/charts.tsx:89)  
    The previous-period series uses the action color at 25%. On the kit’s light and dark surfaces, the composited bars measure about **1.57:1** and **1.76:1** respectively, below the 3:1 target for meaningful graphics. The selected tint is reasonable for navigation, where labels convey state. Give chart series a separate tested color and a second cue such as a pattern or outline.

11. **Several high-use controls miss the kit’s 44 px target.** [controls.tsx:27](../../src/concept/ui/controls.tsx:27) · [controls.tsx:69](../../src/concept/ui/controls.tsx:69) · [assistant-panel.tsx:140](../../src/concept/studio/assistant/assistant-panel.tsx:140)  
    Segmented controls and assistant composer buttons specify 40 px targets, and the shared switch button itself is 28 px high. These controls are used for calendar filters, settings, and voice. Preserve the compact visual treatment inside 44 px interactive areas.

12. **The checked-in kit and runtime CSS are separate sources for the same values.** [kit tokens:2](../../design/brand/libovo-v0.9/tokens/libovo.tokens.css:2) · [runtime tokens:12](../../src/concept/ui/libovo-theme.css:12) · [brand-assets.ts:4](../../src/concept/ui/brand-assets.ts:4)  
    The runtime `light-dark()` representation is a defensible deviation. The existing development CSS shows that Next emits the expected scheme switches. The runtime palette is still a manual copy of the kit, with another copy of the chrome colors in TypeScript. Generate those values from the kit JSON or add a parity test. Keep the documented staff colors and selected-state tint as explicit runtime extensions.

The diff shows no rebrand rename of an existing storage key, environment variable, API route, or MCP namespace. The MCP proposal card retains its approval callbacks, and the stock and finance diffs retain their mutation paths. `git diff --check` passed, and the working tree stayed clean.

## What I could not verify

