import { expect, it } from "vitest";
import { slotOnDate } from "@/concept/studio/booking/slot-picker";

it("only allows a selected slot to be used on its own day", () => {
  const slot = { date: "2026-11-16", start: 600, staffId: "anna" };
  expect(slotOnDate(slot, "2026-11-16")).toBe(slot);
  expect(slotOnDate(slot, "2026-11-17")).toBeNull();
  expect(slotOnDate(null, "2026-11-17")).toBeNull();
});
