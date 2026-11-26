import { describe, expect, it, vi } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { HELP_MAP, helpEntry, helpSteps } from "@/concept/help/map/entries";
import { ANOTHER_DAY, clickFor, clickTarget, findAnchor, INTERACTIVE, mayClickFor, onRoute, ShowMeRefusal } from "@/concept/help/pointer/dom";
import { moveShowMe, startShowMe, stopShowMe } from "@/concept/help/pointer/store";
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
  const page = (...elements: ReturnType<typeof visit>[]) => ({
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

  it("ignores prefer for elements without a state, and tells absent from hidden", () => {
    const button = visit();
    expect(findAnchor("booking.take-payment", "past", page(button))).toEqual({ element: button });
    expect(findAnchor("nav.more", undefined, page())).toBe("absent");
    expect(findAnchor("nav.more", undefined, page(visit(undefined, false)))).toBe("hidden");
  });

  it("points at the day before for a finished visit and the day after for one to come", () => {
    expect(ANOTHER_DAY).toEqual({ past: "calendar.previous", upcoming: "calendar.next" });
    for (const id of Object.values(ANOTHER_DAY)) expect(helpEntry(id)?.route).toBe("/studio/calendar");
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
