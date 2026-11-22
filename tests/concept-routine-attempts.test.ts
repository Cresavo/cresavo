import { expect, it } from "vitest";
import { createRoutineAttempts } from "@/concept/assistant/routine-attempts";

// A refused routine run is retried on a later clock tick, but its proposal is made once. Fictional ids only.

it("retries a refused run once per salon minute and announces its slot once", () => {
  const attempts = createRoutineAttempts();
  const slot = "2026-11-16 08:00";
  expect(attempts.shouldAttempt("salon-a", "monday-reminders", slot, "2026-11-16", 480)).toBe(true);
  expect(attempts.firstAnnouncement("salon-a", "monday-reminders", slot)).toBe(true);
  // The same minute again (another render): no new attempt.
  expect(attempts.shouldAttempt("salon-a", "monday-reminders", slot, "2026-11-16", 480)).toBe(false);
  // A later tick tries the run again, but its proposal is not posted twice.
  expect(attempts.shouldAttempt("salon-a", "monday-reminders", slot, "2026-11-16", 481)).toBe(true);
  expect(attempts.firstAnnouncement("salon-a", "monday-reminders", slot)).toBe(false);
  // The next week's slot is new.
  expect(attempts.firstAnnouncement("salon-a", "monday-reminders", "2026-11-23 08:00")).toBe(true);
});

it("keeps one salon's attempts apart from another's", () => {
  const attempts = createRoutineAttempts();
  const slot = "2026-11-16 08:00";
  expect(attempts.shouldAttempt("salon-a", "friday-stock", slot, "2026-11-16", 480)).toBe(true);
  expect(attempts.shouldAttempt("salon-b", "friday-stock", slot, "2026-11-16", 480)).toBe(true);
  expect(attempts.firstAnnouncement("salon-a", "friday-stock", slot)).toBe(true);
  expect(attempts.firstAnnouncement("salon-b", "friday-stock", slot)).toBe(true);
});
