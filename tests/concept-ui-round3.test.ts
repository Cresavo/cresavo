import { afterEach, describe, expect, it, vi } from "vitest";
import { openStatus } from "@/concept/booking/open-status";
import { openStatusText } from "@/concept/booking/hero";
import { shareVisit, visitShare } from "@/concept/booking/share-visit";
import type { Salon } from "@/concept/data/types";
import { setLocale } from "@/concept/i18n";
import { calendarKey, stepThrough } from "@/concept/studio/calendar/keys";
import { previewPosition } from "@/concept/studio/calendar/preview";
import { installWay, isAppleTouch } from "@/concept/studio/install/install";
import { reachServer } from "@/concept/ui/connection";

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

describe("calendar keys", () => {
  const press = (key: string, extra: Partial<Parameters<typeof calendarKey>[0]> = {}) =>
    calendarKey({ key, metaKey: false, ctrlKey: false, altKey: false, defaultPrevented: false, target: null, ...extra });

  it("moves between days with arrows or J and K, T for today and ? for the list", () => {
    expect(press("ArrowLeft")).toBe("previous");
    expect(press("k")).toBe("previous");
    expect(press("ArrowRight")).toBe("next");
    expect(press("J")).toBe("next");
    expect(press("t")).toBe("today");
    expect(press("?")).toBe("help");
    expect(press("ArrowDown")).toBe("later");
    expect(press("x")).toBeNull();
  });

  it("leaves Cmd+K, Ctrl and Alt keys, typing and widgets with their own arrows alone", () => {
    expect(press("k", { metaKey: true })).toBeNull();
    expect(press("k", { ctrlKey: true })).toBeNull();
    expect(press("ArrowLeft", { altKey: true })).toBeNull();
    expect(press("t", { defaultPrevented: true })).toBeNull();
    const inside = (selector: string) => ({ closest: (own: string) => (own.split(", ").includes(selector) ? {} : null) });
    expect(press("t", { target: inside("input") })).toBeNull();
    expect(press("ArrowRight", { target: inside("[role=radiogroup]") })).toBeNull();
    expect(press("ArrowRight", { target: inside("dialog") })).toBeNull();
    expect(press("ArrowRight", { target: { closest: () => null } })).toBe("next");
  });

  it("steps through the bookings in order and stops at either end", () => {
    const items = ["a", "b", "c"];
    expect(stepThrough(items, null, "later")).toBe("a");
    expect(stepThrough(items, null, "earlier")).toBe("c");
    expect(stepThrough(items, "a", "later")).toBe("b");
    expect(stepThrough(items, "c", "later")).toBe("c");
    expect(stepThrough(items, "a", "earlier")).toBe("a");
    expect(stepThrough([], null, "later")).toBeNull();
  });
});

describe("calendar preview", () => {
  const viewport = { width: 1280, height: 800 };
  const size = { width: 288, height: 120 };

  it("sits beside the block where there is room, else on its other side", () => {
    expect(previewPosition({ left: 300, right: 400, top: 200 }, size, viewport)).toEqual({ left: 408, top: 200 });
    expect(previewPosition({ left: 1000, right: 1100, top: 200 }, size, viewport)).toEqual({ left: 704, top: 200 });
  });

  it("stays inside the window at the top and bottom", () => {
    expect(previewPosition({ left: 300, right: 400, top: -40 }, size, viewport).top).toBe(16);
    expect(previewPosition({ left: 300, right: 400, top: 760 }, size, viewport).top).toBe(664);
  });
});

describe("add to home screen", () => {
  it("offers the browser's dialog, Safari's guidance, or nothing", () => {
    expect(installWay({ standalone: false, prompt: true, ios: false })).toBe("prompt");
    expect(installWay({ standalone: false, prompt: false, ios: true })).toBe("ios");
    expect(installWay({ standalone: false, prompt: false, ios: false })).toBeNull();
    expect(installWay({ standalone: true, prompt: true, ios: true })).toBeNull();
  });

  it("knows an iPhone and an iPad that presents itself as a Mac", () => {
    expect(isAppleTouch("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "iPhone", 5)).toBe(true);
    expect(isAppleTouch("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5)).toBe(true);
    expect(isAppleTouch("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0)).toBe(false);
    expect(isAppleTouch("Mozilla/5.0 (Linux; Android 15)", "Linux armv8l", 5)).toBe(false);
  });
});

describe("connection check", () => {
  it("counts any answer from the server as online, even an error page, and only a lost request as offline", async () => {
    const answer = vi.fn(async () => new Response(null, { status: 404 }));
    expect(await reachServer(answer as unknown as typeof fetch)).toBe(true);
    expect(answer).toHaveBeenCalledWith(expect.stringMatching(/^\/favicon\.ico\?connection=\d+$/), expect.objectContaining({ method: "HEAD", cache: "no-store" }));
    expect(await reachServer((async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch)).toBe(false);
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
