import { afterEach, describe, expect, it, vi } from "vitest";
import { openStatus } from "@/concept/booking/open-status";
import { openStatusText } from "@/concept/booking/hero";
import { shareVisit, visitShare } from "@/concept/booking/share-visit";
import type { Salon } from "@/concept/data/types";
import { setLocale } from "@/concept/i18n";

// A Wednesday with long hours and lunch, and a short Saturday (no lunch: the day is six hours or less).
const WEDNESDAY = "2026-11-25";
const SATURDAY = "2026-11-28";
const salon = {
  hours: { 0: null, 1: { open: 540, close: 1080 }, 2: { open: 540, close: 1080 }, 3: { open: 540, close: 1080 }, 4: { open: 540, close: 1080 }, 5: { open: 540, close: 1080 }, 6: { open: 600, close: 900 } },
  lunch: { start: 720, end: 780 },
  closures: [],
} as unknown as Salon;

afterEach(() => {
  setLocale("en");
  vi.unstubAllGlobals();
});

describe("open status on the booking page", () => {
  it("says open until closing, then closing soon in the last hour, from the salon's own hours", () => {
    expect(openStatus(salon, WEDNESDAY, 600)).toEqual({ kind: "open", until: 1080 });
    expect(openStatus(salon, WEDNESDAY, 1019)).toEqual({ kind: "open", until: 1080 });
    expect(openStatus(salon, WEDNESDAY, 1020)).toEqual({ kind: "closingSoon", until: 1080 });
    expect(openStatus(salon, WEDNESDAY, 1080)).toEqual({ kind: "closed" });
    expect(openStatus(salon, WEDNESDAY, 500)).toEqual({ kind: "closed" });
  });

  it("tells lunch apart from a closed day, and only on days that have a lunch break", () => {
    expect(openStatus(salon, WEDNESDAY, 720)).toEqual({ kind: "lunch", until: 780 });
    expect(openStatus(salon, WEDNESDAY, 779)).toEqual({ kind: "lunch", until: 780 });
    expect(openStatus(salon, WEDNESDAY, 780)).toEqual({ kind: "open", until: 1080 });
    expect(openStatus(salon, SATURDAY, 720)).toEqual({ kind: "open", until: 900 });
    expect(openStatus({ ...salon, closures: [{ date: WEDNESDAY, name: "Staff day" }] } as Salon, WEDNESDAY, 600)).toEqual({ kind: "closed" });
  });

  it("names the salon's own time in both languages", () => {
    expect(openStatusText({ kind: "closingSoon", until: 1080 })).toBe("Closing soon, until 18:00");
    expect(openStatusText({ kind: "lunch", until: 780 })).toBe("Closed for lunch until 13:00");
    expect(openStatusText({ kind: "open", until: 1080 })).toBe("Open now until 18:00");
    setLocale("sv");
    expect(openStatusText({ kind: "closingSoon", until: 1080 })).toBe("Stänger snart, till 18:00");
    expect(openStatusText({ kind: "lunch", until: 780 })).toBe("Lunchstängt till 13:00");
  });
});

describe("share this time", () => {
  const visit = { salon: "Salong Eko", date: WEDNESDAY, start: 870, url: "https://example.test/boka/salong-eko" };

  it("carries the day, the time, the salon and the link", () => {
    expect(visitShare(visit)).toEqual({ title: "Salong Eko", text: "My time at Salong Eko: Wednesday 25 November at 14:30.", url: visit.url });
  });

  it("uses the share sheet, treats closing it as done, and copies the link where there is no sheet", async () => {
    const share = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });
    expect(await shareVisit(visit)).toBe("shared");
    expect(share).toHaveBeenCalledWith(visitShare(visit));

    vi.stubGlobal("navigator", { share: async () => { throw new DOMException("closed", "AbortError"); } });
    expect(await shareVisit(visit)).toBe("shared");

    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await shareVisit(visit)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(visit.url);

    vi.stubGlobal("navigator", { clipboard: { writeText: async () => { throw new Error("denied"); } } });
    expect(await shareVisit(visit)).toBe("failed");
  });
});
