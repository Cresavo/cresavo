import { describe, expect, it } from "vitest";
import { layoutCalendarCards } from "../src/app/admin/calendar-layout";

function assertNoCollisions(cards: ReturnType<typeof layoutCalendarCards>) {
  const values = [...cards.values()];
  for (let i = 0; i < values.length; i++) {
    const a = values[i];
    expect(a.height).toBeGreaterThanOrEqual(24);
    for (const b of values.slice(i + 1)) {
      const vertical = a.top < b.top + b.height && b.top < a.top + a.height;
      const horizontal =
        a.column / a.columns < (b.column + 1) / b.columns &&
        b.column / b.columns < (a.column + 1) / a.columns;
      expect(vertical && horizontal).toBe(false);
    }
  }
}
describe("calendar hit-target layout", () => {
  it("keeps ordinary 30/60-minute visits full-width at their actual time", () => {
    const result = layoutCalendarCards([
      { id: "a", top: 0, height: 70 },
      { id: "b", top: 72, height: 142 },
    ]);
    expect(
      [...result.values()].map((p) => [p.top, p.height, p.columns]),
    ).toEqual([
      [0, 70, 1],
      [72, 142, 1],
    ]);
    assertNoCollisions(result);
  });
  it("gives 20 consecutive five-minute visits 24px targets in only two columns", () => {
    const input = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      top: i * 12,
      height: 10,
    }));
    const result = layoutCalendarCards(input);
    expect([...result.values()].every((p) => p.columns === 2)).toBe(true);
    expect([...result.values()].map((p) => p.top)).toEqual(
      input.map((p) => p.top),
    );
    assertNoCollisions(result);
  });
  it("also separates a long visit immediately after short visits, then restores full width", () => {
    const result = layoutCalendarCards([
      { id: "a", top: 0, height: 10 },
      { id: "b", top: 12, height: 10 },
      { id: "c", top: 24, height: 70 },
      { id: "d", top: 96, height: 70 },
    ]);
    expect(result.get("c")?.columns).toBe(2);
    expect(result.get("d")?.columns).toBe(1);
    assertNoCollisions(result);
  });
  it("handles unordered mixed lengths without mutating the source", () => {
    const input = [
      { id: "c", top: 36, height: 22 },
      { id: "a", top: 0, height: 10 },
      { id: "b", top: 12, height: 22 },
    ];
    const before = JSON.stringify(input);
    const result = layoutCalendarCards(input);
    expect(JSON.stringify(input)).toBe(before);
    assertNoCollisions(result);
    expect(result.get("c")?.top).toBe(36);
  });
});
