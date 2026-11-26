import { describe, expect, it, vi } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { HELP_MAP, helpEntry, helpSteps } from "@/concept/help/map/entries";
import { ANOTHER_DAY, clickFor, clickTarget, currentAnchor, findAnchor, INTERACTIVE, mayClickFor, onRoute, ShowMeRefusal } from "@/concept/help/pointer/dom";
import { steerFor } from "@/concept/help/pointer/steer";
import { moveShowMe, startShowMe, stopShowMe } from "@/concept/help/pointer/store";
import { en } from "@/concept/i18n/en";
import { sv } from "@/concept/i18n/sv";
import { setupGaps } from "@/concept/help/setup-gaps";
import { showMeTool } from "@/concept/help/show-me-tool";
import { friendlyMessage, friendlyText } from "@/concept/ui/friendly-copy";

const state = createDemoState("2026-11-17");

describe("Show me never presses what changes data", () => {
  it.each(["booking.move", "booking.take-payment", "advanced.reset-demo", "inbox.reply", "customer.delete", "calendar.new-booking", "link.copy"])("refuses to click %s", (id) => {
    const element = { click: vi.fn() };
    const entry = helpEntry(id)!;
    expect(mayClickFor(entry)).toBe(false);
    expect(() => clickFor(entry, element)).toThrow(ShowMeRefusal);
    expect(element.click).not.toHaveBeenCalled();
  });

  it("clicks a step that only opens a page or a view", () => {
    const element = { click: vi.fn() };
    clickFor(helpEntry("nav.more")!, element);
    clickFor(helpEntry("calendar.booking")!, element);
    expect(element.click).toHaveBeenCalledTimes(2);
  });

  it("presses the control, not a wrapper around it", () => {
    const button = { click: vi.fn(), matches: (selector: string) => selector === INTERACTIVE };
    const wrapper = { click: vi.fn(), matches: () => false, querySelectorAll: () => [button] };
    clickFor(helpEntry("help.history")!, wrapper);
    expect(button.click).toHaveBeenCalledTimes(1);
    expect(wrapper.click).not.toHaveBeenCalled();
    expect(clickTarget(button)).toBe(button);
    expect(clickTarget({ click: vi.fn(), matches: () => false, querySelectorAll: () => [] })).toBeNull();
    expect(clickTarget({ click: vi.fn(), matches: () => false, querySelectorAll: () => [button, button] })).toBeNull();
    expect(() => clickFor(helpEntry("help.history")!, { click: vi.fn(), matches: () => false, querySelectorAll: () => [] })).toThrow(/not one control/);
  });

  it("refuses every changes-data entry in the map", () => {
    const changing = HELP_MAP.filter((entry) => entry.safety === "changes-data");
    expect(changing.length).toBeGreaterThan(30);
    for (const entry of changing) expect(() => clickFor(entry, { click: () => { throw new Error("pressed"); } })).toThrow(ShowMeRefusal);
  });
});

describe("finding the element to point at", () => {
  // A stand-in page: visits on screen with their state, and no open dialog.
  const visit = (helpState?: string, shown = true) => ({ dataset: { helpState }, getClientRects: () => (shown ? [{}] : []), closest: () => null });
  const page = (...elements: object[]) => ({
    querySelectorAll: (selector: string) => (selector.startsWith("dialog") ? [] : elements),
  }) as unknown as Pick<Document, "querySelectorAll">;

  it("opens only a visit in the state asked for", () => {
    const finished = visit("past");
    expect(findAnchor("calendar.booking", "past", page(visit("upcoming"), finished))).toEqual({ element: finished });
  });

  it("never falls back to a visit that cannot offer the action", () => {
    expect(findAnchor("calendar.booking", "past", page(visit("upcoming"), visit("upcoming")))).toBe("unmatched");
    expect(findAnchor("calendar.booking", "upcoming", page(visit("past")))).toBe("unmatched");
    // A finished visit that is off screen does not count either.
    expect(findAnchor("calendar.booking", "past", page(visit("upcoming"), visit("past", false)))).toBe("unmatched");
  });

  it("ignores prefer for elements without a state, and tells absent, hidden and blocked apart", () => {
    const button = visit();
    expect(findAnchor("booking.take-payment", "past", page(button))).toEqual({ element: button });
    expect(findAnchor("nav.more", undefined, page())).toBe("absent");
    expect(findAnchor("nav.more", undefined, page(visit(undefined, false)))).toBe("hidden");
    // On screen, but behind an open sheet: not an empty list.
    const covered = { ...visit(), closest: (selector: string) => (selector === "[inert]" ? {} : null) };
    expect(findAnchor("calendar.booking", undefined, page(covered))).toBe("blocked");
  });

  it("presses only the outlined element while it is still the page's current one", () => {
    const outlined = { ...visit("upcoming"), isConnected: true } as unknown as HTMLElement;
    expect(currentAnchor("calendar.booking", "upcoming", outlined, page(outlined))).toBe(outlined);
    // The day changed: another visit is there now, or none, or the old one is detached.
    const other = { ...visit("upcoming"), isConnected: true };
    expect(currentAnchor("calendar.booking", "upcoming", outlined, page(other))).toBeNull();
    expect(currentAnchor("calendar.booking", "upcoming", outlined, page())).toBeNull();
    const detached = { ...visit("upcoming"), isConnected: false } as unknown as HTMLElement;
    expect(currentAnchor("calendar.booking", "upcoming", detached, page(detached))).toBeNull();
    expect(currentAnchor("calendar.booking", "upcoming", null, page(other))).toBeNull();
  });

  it("points at the day before for a finished visit and the day after for one to come", () => {
    expect(ANOTHER_DAY).toEqual({ past: "calendar.previous", upcoming: "calendar.next" });
    for (const id of Object.values(ANOTHER_DAY)) expect(helpEntry(id)?.route).toBe("/studio/calendar");
  });
});

describe("an empty list on the way", () => {
  const entry = (id: string) => helpEntry(id)!;
  const ready = { onPage: true, settled: true };

  it("points at another day when the calendar has no bookings, kind or not", () => {
    expect(steerFor(entry("calendar.booking"), entry("calendar.booking"), "absent", ready)).toEqual({ kind: "empty", pointAt: ["calendar.next", "calendar.new-booking"] });
    expect(steerFor(entry("calendar.booking"), entry("booking.take-payment"), "absent", ready)).toEqual({ kind: "unmatched", pointAt: ["calendar.previous"] });
    expect(steerFor(entry("calendar.booking"), entry("booking.move"), "unmatched", ready)).toEqual({ kind: "unmatched", pointAt: ["calendar.next"] });
  });

  it("waits while the page is not there yet, still drawing, or covered by a sheet", () => {
    const booking = entry("calendar.booking");
    expect(steerFor(booking, booking, "absent", { onPage: false, settled: true })).toBeNull();
    expect(steerFor(booking, booking, "absent", { onPage: true, settled: false })).toBeNull();
    expect(steerFor(booking, booking, "blocked", ready)).toBeNull();
    expect(steerFor(booking, booking, "hidden", ready)).toBeNull();
    // A place that is not a list item is missing, not empty.
    expect(steerFor(entry("nav.more"), entry("nav.more"), "absent", ready)).toBeNull();
  });

  it("explains every list that can be empty in both languages and points at things on its own page", () => {
    const lists = HELP_MAP.filter((item) => item.empty);
    expect(lists.map((item) => item.id).sort()).toEqual(["calendar.booking", "customers.row", "inbox.message", "services.treatment"]);
    const english: Record<string, string> = en.messages;
    const swedish: Record<string, string> = sv.messages;
    for (const item of lists) {
      for (const part of ["what", "next"]) {
        const key = `showMe.${item.id}.empty.${part}`;
        expect(english[key], key).toBeTruthy();
        expect(swedish[key], key).toBeTruthy();
      }
      for (const id of item.empty!.pointAt) expect(helpEntry(id)?.route, `${item.id} → ${id}`).toBe(item.route);
    }
  });
});

describe("Show me routes and guide", () => {
  it("matches a route, including a record's own page", () => {
    expect(onRoute("/studio/more/settings", "/studio/more/settings")).toBe(true);
    expect(onRoute("/studio/more/settings/", "/studio/more/settings")).toBe(true);
    expect(onRoute("/studio/more/settings/hours", "/studio/more/settings")).toBe(false);
    expect(onRoute("/studio/customers/c-12", "/studio/customers/[id]")).toBe(true);
    expect(onRoute("/studio/customers", "/studio/customers/[id]")).toBe(false);
  });

  it("follows Mer, Inställningar and Avancerat to reset the demo", () => {
    expect(helpSteps("advanced.reset-demo").map((step) => step.id)).toEqual(["nav.more", "more.settings", "settings.advanced", "advanced.reset-demo"]);
  });

  it("starts only for a known place", () => {
    expect(startShowMe("not.a.place")).toBe(false);
    expect(startShowMe("booking.move")).toBe(true);
    moveShowMe(2);
    stopShowMe();
  });
});

describe("show_me as an assistant tool", () => {
  it("is a read tool whose last step is a proposal when it changes data", () => {
    expect(showMeTool.kind).toBe("read");
    const result = showMeTool.run({ state, clock: { today: "2026-11-17", minutes: 600 } } as never, { question: "hur flyttar jag en bokning?" });
    expect(result.place).toEqual({
      id: "booking.move",
      route: "/studio/calendar",
      steps: [{ id: "nav.calendar", kind: "read" }, { id: "calendar.booking", kind: "read" }, { id: "booking.move", kind: "propose" }],
    });
  });

  it("validates its input", () => {
    expect(showMeTool.input.safeParse({ question: "" }).success).toBe(false);
  });
});

describe("missing setup", () => {
  it("finds nothing missing in a salon that is ready, apart from sharing", () => {
    expect(setupGaps(state)).toEqual(["share"]);
    expect(setupGaps({ ...state, dismissedCards: [...state.dismissedCards, `shared:${state.salon.slug}`] })).toEqual([]);
  });

  it("names treatments and opening hours first", () => {
    const empty = { ...state, services: [], salon: { ...state.salon, hours: Object.fromEntries(Object.keys(state.salon.hours).map((day) => [day, null])) } };
    expect(setupGaps(empty)).toEqual(["services", "hours", "share"]);
  });
});

describe("friendly messages", () => {
  it("say what happened, why and what to do, in one line when needed", () => {
    const message = friendlyMessage({ what: "setupGaps.hours.what", why: "setupGaps.hours.why", next: "setupGaps.hours.next", showMe: "hours.weekly" });
    expect(message).toEqual({ what: "The salon has no opening hours.", why: "Without them there are no free times to book.", next: "Choose the days and times you are open.", showMe: "hours.weekly" });
    expect(friendlyText(message)).toBe("The salon has no opening hours. Without them there are no free times to book. Choose the days and times you are open.");
  });
});
