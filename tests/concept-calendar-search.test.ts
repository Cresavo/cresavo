import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { TimePicker } from "@/concept/booking/time-picker";
import { isDateKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { setLocale } from "@/concept/i18n";
import { fullName } from "@/concept/selectors";
import { swipeDirection } from "@/concept/studio/calendar/month-reveal";
import { calendarUrlWithoutDate } from "@/concept/studio/calendar/show-day";
import { fold, matchScore, paletteResults, resolveRecent } from "@/concept/studio/search/palette-items";
import { monthCells, shiftMonth } from "@/concept/ui/month-grid";

const today = "2026-11-16";
const state = createDemoState(today);
const owner = { state, role: "owner" as const, today };

afterEach(() => setLocale("en"));

describe("month grid", () => {
  it("lays out a month in Monday-first weeks", () => {
    // 1 November 2026 is a Sunday: six blanks before it.
    const cells = monthCells("2026-11");
    expect(cells.slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(cells.filter(Boolean)).toHaveLength(30);
    expect(monthCells("2026-06")[0]).toBe("2026-06-01");
  });

  it("moves across a year", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-11", 14)).toBe("2028-01");
  });

  it("accepts only real days as a calendar link", () => {
    expect(isDateKey("2026-12-03")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("tomorrow")).toBe(false);
  });
});

describe("calendar month swipe", () => {
  it("opens on a swipe up, closes on a swipe down and ignores scrolls and sideways moves", () => {
    expect(swipeDirection(4, -60, false)).toBe(-1);
    expect(swipeDirection(-4, 60, false)).toBe(1);
    expect(swipeDirection(0, -20, false)).toBe(0);
    expect(swipeDirection(80, -50, false)).toBe(0);
    expect(swipeDirection(0, -80, true)).toBe(0);
  });
});

describe("booking time picker", () => {
  it("shows a month to pick from with the chosen day's times beside it", () => {
    const serviceId = state.services[0].id;
    const html = renderToStaticMarkup(createElement(TimePicker, { state, serviceId, clock: { today, minutes: 480 }, onPick: () => {}, onWaitlist: () => {} }));
    expect(html).toContain('role="group" aria-label="Choose a day"');
    expect(html).toContain("November 2026");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-current="date"');
    // Days before today cannot be chosen.
    expect(html).toMatch(/data-date="2026-11-10" disabled=""/);
    expect(html).toContain("ui-day-time-layout");
  });
});

describe("search palette", () => {
  it("folds case and accents", () => {
    expect(fold("Åse Öberg")).toBe("ase oberg");
    expect(matchScore("Calendar", "cal")).toBe(0);
    expect(matchScore("History and undo", "undo")).toBe(1);
    expect(matchScore("Opening hours", "ning")).toBe(2);
    expect(matchScore("Inbox", "zz")).toBeNull();
  });

  it("puts the assistant first on an empty search so the shortcut and Enter still reach it", () => {
    const results = paletteResults(owner, "");
    expect(results[0]).toMatchObject({ id: "assistant", label: "Ask the assistant" });
    expect(results.some((item) => item.href === "/studio/inbox")).toBe(true);
    expect(results.some((item) => item.href === "/studio/more/settings/hours")).toBe(true);
    expect(results.some((item) => item.group === "customers")).toBe(false);
    const off = { ...owner, state: { ...state, modules: { ...state.modules, assistant: false } } };
    expect(paletteResults(off, "").some((item) => item.id === "assistant")).toBe(false);
  });

  it("finds a customer, a day and a page, and offers the typed words to the assistant last", () => {
    const customer = state.customers[0];
    const results = paletteResults(owner, customer.firstName);
    expect(results[0].group).toBe("customers");
    expect(results.some((item) => item.href === `/studio/customers/${customer.id}`)).toBe(true);
    expect(results.at(-1)).toMatchObject({ id: "assistant", label: `Ask the assistant: ${customer.firstName}` });

    expect(paletteResults(owner, "tomorrow")[0]).toMatchObject({ group: "days", href: "/studio/calendar?date=2026-11-17" });
    expect(paletteResults(owner, "2026-12-24")[0]).toMatchObject({ group: "days", href: "/studio/calendar?date=2026-12-24" });
    expect(paletteResults(owner, "inbox").find((item) => item.group === "places")?.href).toBe("/studio/inbox");
  });

  it("speaks Swedish", () => {
    setLocale("sv");
    expect(paletteResults(owner, "imorgon")[0]).toMatchObject({ group: "days", href: "/studio/calendar?date=2026-11-17" });
    expect(paletteResults(owner, "")[0].label).toBe("Fråga assistenten");
  });

  it("gives staff only their pages and the customers they serve", () => {
    const staff = { ...owner, role: "staff" as const };
    const hrefs = paletteResults(staff, "").map((item) => item.href).filter(Boolean);
    expect(hrefs).toEqual(expect.arrayContaining(["/studio", "/studio/calendar", "/studio/customers"]));
    expect(hrefs).not.toContain("/studio/inbox");
    expect(hrefs.some((href) => href!.startsWith("/studio/more"))).toBe(false);
    const viewer = state.staff[1];
    const stranger = state.customers.find((c) => !state.bookings.some((b) => b.customerId === c.id && b.staffId === viewer.id));
    if (stranger) {
      expect(paletteResults(staff, fullName(stranger)).some((item) => item.id === `customer:${stranger.id}`)).toBe(false);
      expect(resolveRecent(staff, `customer:${stranger.id}`)).toBeUndefined();
    }
    expect(resolveRecent(staff, "page:/studio/more/finance")).toBeUndefined();
  });

  it("finds Recent items again and drops ones that are gone", () => {
    expect(resolveRecent(owner, "page:/studio/inbox")?.label).toBe("Inbox");
    expect(resolveRecent(owner, "day:2026-12-03")?.href).toBe("/studio/calendar?date=2026-12-03");
    expect(resolveRecent(owner, "customer:nobody")).toBeUndefined();
    expect(resolveRecent(owner, "day:not-a-day")).toBeUndefined();
  });
});

describe("calendar date link", () => {
  it("drops only the date from the address", () => {
    expect(calendarUrlWithoutDate("/studio/calendar?date=2026-11-18")).toBe("/studio/calendar");
    expect(calendarUrlWithoutDate("/studio/calendar?date=2026-11-18&booking=b1")).toBe("/studio/calendar?booking=b1");
    expect(calendarUrlWithoutDate("/studio/calendar")).toBeNull();
    expect(calendarUrlWithoutDate("/studio/calendar?view=week")).toBeNull();
  });
});
