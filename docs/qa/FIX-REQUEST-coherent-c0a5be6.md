# Fix request – coherent salon workspace @ c0a5be64fcca17a964b3ef8335ff6851eb5797f8 (round 1 of max 2)

Source: independent QA t79u, report `QA-REPORT-coherent-c0a5be6.md` (Swedish). Synthetic local copy only; Playwright Chromium headless; no iPhone/Safari/native claims.
Scope: UI only. Do not touch auth/API/domain/data model/MCP/dependencies/migrations (all verified unchanged vs 05e5eaf).

## Must fix (Medium)

### CS-QA-1 – Return-link scroll restore fails in dev mode; web matrix red in 2/4 modes
- Own results: prod0 54/54, prod1 54/54, **dev0 53/54, dev1 53/54** – `[desktop] tests/e2e/coherence.spec.ts:9`, assertion line 113, `scrollY` expected 774, received 0 (deterministic).
- Code: `src/app/components/context-link.tsx`, `RestoreReturnScroll` (~L80–153). The storage key is removed (L91) and the `#return-<uuid>` hash stripped via `history.replaceState` (L92–96) before the scroll is applied; the effect cleanup calls `stopPending()` (L147–148).
- Likely cause: React StrictMode mount→cleanup→mount in dev. The first pass consumes key+hash, the cleanup cancels the pending scroll, and the second pass finds nothing. The effect is not idempotent.
- Fix direction: consume the key and strip the hash only after `scrollTo` has actually run (on success/timeout), or keep the pending value in a ref/module cache that survives a StrictMode remount. Acceptance: 54/54 in all four modes (dev/prod × proxy 0/1).

### CS-QA-2 – Browser Back does not restore calendar scroll (brief use case 2: "Vanlig bakåtknapp")
- Repro at 390×700:
  1. Log in and open `/admin?date=<day>&view=week&staffId=<staff>&status=all`.
  2. Scroll down to a booking (y≈2000) and click it.
  3. Go Back.
  4. Result: URL and filters are correct, but `scrollY` = 0.
  5. This failed 6/6 times with bfcache disabled or allowed, and 2/2 times at 390/1280 in the first probe.
- Cause: `ContextLink` is a plain `<a>`, so it triggers a full document load. `/admin` is served with `Cache-Control: no-store`, so Back reloads the document. Native scroll restoration loses the race with streamed content; a plain reload also returns to 0 in 3 of 6 runs.
- Fix direction: on click or `pagehide`, store the current `scrollY` for the current history entry, e.g. `history.replaceState({...history.state, bookingScrollY})` or sessionStorage keyed per entry. On a `back_forward` navigation or `pageshow`, restore it with the existing wait-for-height logic, without fighting user input. Alternatively, use client navigation via Next `Link`. Add an E2E test that uses `page.goBack()`, for desktop and mobile.

## Should fix in the same round (Low, cheap)
- **CS-QA-3:** `src/app/admin/header-menu.tsx` L14–33. The menu stays open when focus Tabs out. At 390 px the Konto panel covers the newly focused "Öppna kalendern" button (WCAG 2.4.11). Fix: close on `focusout` when `relatedTarget` is outside the `<details>`.
- **CS-QA-4:** `src/app/admin/bookings/editor.tsx` ~L326–331. "Behåll bokningen" drops focus to BODY. Fix: return focus to the "Avboka" button (ref + rAF, like `abandonMove`).
- **CS-QA-5:** some targets are smaller than 24 px:
  - brand link 163×23/17 (`admin/header.tsx:28`);
  - "Så använder du kalendern" summary, 22 px tall (`admin/calendar.tsx:105`);
  - "Visa arkiverade" checkbox 18×18 (`admin/customers/page.tsx:85`);
  - /admin checkbox 18×44;
  - day link "fre 13/11" 55×16 at 1280.
  
  Fix: give them `min-height: 24px` (44 px on touch).

## Backlog (Info)
- **CS-QA-6:** the move-cancel label changes between "Avbryt flytt" (`editor.tsx:452`) and "Avbryt" (~L546). Unify them.
- **CS-QA-7:** the campaign draft defaults to a single day (`overview/overview.tsx:142–143`). Consider a multi-day default.
- **CS-QA-8:** `useUnsavedChanges` only snapshots `HTMLInputElement` (`admin/use-write.ts` ~L123). Include select and textarea.

## Re-check plan for round 2
Same synthetic setup:
- full 4-mode E2E matrix (54 × 4);
- own Playwright probes B/B2 (return link + browser Back at 390/1280), F2 (menus) and E2 (Behåll focus);
- a diff check that the changes are confined to the files above.
