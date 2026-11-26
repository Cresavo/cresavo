import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { addDays } from "@/concept/data/dates";
import { createDemoState, DEMO_VERSION } from "@/concept/data/generate";
import { payAtSalon } from "./helpers/pay-at-salon";
import { migrateState } from "@/concept/data/migrate";
import { freeStarts, needOf } from "@/concept/data/slots";
import type { DemoState } from "@/concept/data/types";
import { applyAction } from "@/concept/log/capture";
import type { LogMeta } from "@/concept/log/types";
import { isUndoable } from "@/concept/log/undo";
import { lookup } from "@/concept/assistant/lookups";
import { parseCampaignRequest } from "@/concept/campaigns/prefill";
import { proposalFor } from "@/concept/command/proposal";
import { bookableServices, findService, publicView } from "@/concept/selectors";
import { categoryIssues, MAX_DETAILS, serviceIssues, serviceUsage, tidyDetails, type ServiceDraft } from "@/concept/services/edit";
import { salonCopy } from "@/concept/i18n/salon-eko-copy";
import { publicSalonView } from "@/concept/booking/public-projection";

const today = "2026-11-16";
const base = payAtSalon(createDemoState(today));
const meta: LogMeta = { actor: "owner", source: "button", at: Date.UTC(2026, 10, 16, 9, 30) };
const draft: ServiceDraft = { name: "Hot stone massage", category: "massage", duration: 75, price: 990, description: "Warm stones and slow strokes.", staffIds: ["erik"] };
const guest = { name: "Test Person", phone: "070-000 00 01", at: { date: today, time: 600 } };
const notice = { title: "New booking", body: "" };
const ids = (state: DemoState, category?: string) => state.services.filter((s) => !category || s.category === category).map((s) => s.id);

/** The first day from three weeks ahead (inside the 28 days the public page books) where Erik has room for the treatment, and the first start that day. */
function freeSlot(state: DemoState, need: { serviceId: string; duration: number }) {
  let date = addDays(today, 21);
  while (!freeStarts(state, "erik", date, need).length) date = addDays(date, 1);
  return { date, start: freeStarts(state, "erik", date, need)[0] };
}

/** Runs an action through the log, as the store does, and returns the state and its newest entry. */
function logged(state: DemoState, action: Parameters<typeof reduce>[1]) {
  const next = applyAction(state, action, meta);
  return { next, entry: next.log[0] };
}

describe("price list validation", () => {
  it("accepts a complete treatment", () => {
    expect(serviceIssues(base, draft)).toEqual([]);
  });

  it("needs a name of a sensible length", () => {
    expect(serviceIssues(base, { ...draft, name: "   " })).toEqual(["name"]);
    expect(serviceIssues(base, { ...draft, name: "x".repeat(61) })).toEqual(["name"]);
  });

  it("wants a unique name within the category, ignoring case and the treatment being edited", () => {
    expect(serviceIssues(base, { ...draft, name: " classic massage 60 MIN " })).toEqual(["nameTaken"]);
    expect(serviceIssues(base, { ...draft, name: "Classic massage 60 min", category: "foot", staffIds: ["anna"] })).toEqual([]);
    expect(serviceIssues(base, { ...draft, name: "Classic massage 60 min" }, "classic-60")).toEqual([]);
  });

  it("keeps the length within 5 minutes to 8 hours in 5-minute steps", () => {
    for (const duration of [0, 4, 7, 485, 12.5, Number.NaN]) expect(serviceIssues(base, { ...draft, duration })).toEqual(["duration"]);
    for (const duration of [5, 60, 480]) expect(serviceIssues(base, { ...draft, duration })).toEqual([]);
  });

  it("takes prices to the nearest öre within the allowed range", () => {
    for (const price of [-1, 99.555, 100_001, Number.NaN]) expect(serviceIssues(base, { ...draft, price })).toEqual(["price"]);
    for (const price of [0, 0.29, 555.55, 100_000]) expect(serviceIssues(base, { ...draft, price })).toEqual([]);
  });

  it("shows the exact AI-proposed price in approval and history and lets the owner edit the treatment", () => {
    const serviceId = "classic-60";
    const propose = (priceSek: number) => proposalFor(base, {
      action: "change-price", params: { serviceId, priceSek }, summary: "", confidence: 1,
    }, "", { today, minutes: 9 * 60 }, []);
    const proposal = propose(555.55);
    expect(proposal.kind).toBe("change");
    if (proposal.kind !== "change") throw new Error("Expected a price proposal");
    expect(proposal.rows[0].after).toBe("SEK\u00a0555.55");
    const { next, entry } = logged(base, proposal.action);
    expect(entry.after).toBe("SEK\u00a0555.55");
    const service = next.services.find(s => s.id === serviceId)!;
    expect(service.price).toBe(555.55);
    const edited = reduce(next, { type: "service/update", id: serviceId, service: { ...service, name: "Renamed treatment" } });
    expect(edited.services.find(s => s.id === serviceId)).toMatchObject({ name: "Renamed treatment", price: 555.55 });
    expect(propose(555.555).kind).toBe("message");
    expect(reduce(base, { type: "service/price", id: serviceId, price: 555.555 })).toBe(base);
  });

  it("needs a known category, someone on the team and a short description", () => {
    expect(serviceIssues(base, { ...draft, category: "nope" })).toEqual(["category"]);
    expect(serviceIssues(base, { ...draft, staffIds: [] })).toEqual(["staff"]);
    expect(serviceIssues(createDemoState(today, { solo: true }), draft)).toEqual(["staff"]);
    expect(serviceIssues(base, { ...draft, description: "x".repeat(241) })).toEqual(["description"]);
  });

  it("takes an optional longer text of at most 1,500 characters and a photo from the page's own set", () => {
    expect(serviceIssues(base, { ...draft, details: "" })).toEqual([]);
    expect(serviceIssues(base, { ...draft, details: "First.\n\nSecond.", image: "massage" })).toEqual([]);
    expect(serviceIssues(base, { ...draft, details: "x".repeat(MAX_DETAILS) })).toEqual([]);
    expect(serviceIssues(base, { ...draft, details: "x".repeat(MAX_DETAILS + 1) })).toEqual(["details"]);
    // Spaces and blank lines that are tidied away do not count towards the limit.
    expect(serviceIssues(base, { ...draft, details: `${"x".repeat(MAX_DETAILS)}  \n\n\n` })).toEqual([]);
    expect(serviceIssues(base, { ...draft, details: 5 as unknown as string })).toEqual(["details"]);
    expect(serviceIssues(base, { ...draft, image: "" })).toEqual([]);
    for (const image of ["https://example.test/a.jpg", "data:image/png;base64,AAAA", "nope"]) expect(serviceIssues(base, { ...draft, image })).toEqual(["image"]);
  });

  it("keeps the longer text as plain text with its paragraphs", () => {
    expect(tidyDetails("  One.  \r\nTwo.\r\n\r\n\r\n\r\nThree. \n ")).toBe("One.\nTwo.\n\nThree.");
    expect(tidyDetails("<b>Bold</b> and **stars**")).toBe("<b>Bold</b> and **stars**");
    expect(tidyDetails(undefined)).toBe("");
  });

  it("checks category names the same way", () => {
    expect(categoryIssues(base, " ")).toEqual(["name"]);
    expect(categoryIssues(base, "massage")).toEqual(["nameTaken"]);
    expect(categoryIssues(base, "Massage", "massage")).toEqual([]);
    expect(categoryIssues(base, "Add-ons")).toEqual([]);
  });
});

describe("treatment actions", () => {
  it("adds a treatment at the end of the list, trimmed, with the rooms it can use", () => {
    const { next, entry } = logged(base, { type: "service/add", service: { ...draft, name: "  Hot stone massage " } });
    const added = next.services.at(-1)!;
    expect(added).toMatchObject({ name: "Hot stone massage", category: "massage", duration: 75, price: 990, staffIds: ["erik"], resourceIds: ["room-1", "room-2"] });
    expect(added.hidden).toBeUndefined();
    expect(entry).toMatchObject({ type: "service/add", summary: "Added the treatment Hot stone massage" });
    expect(reduce(next, { type: "log/undo", id: entry.id }).services).toEqual(base.services);
  });

  it("refuses an invalid treatment without logging anything", () => {
    expect(applyAction(base, { type: "service/add", service: { ...draft, name: "" } }, meta)).toBe(base);
    expect(applyAction(base, { type: "service/add", service: { ...draft, price: -5 } }, meta)).toBe(base);
    expect(applyAction(base, { type: "service/update", id: "classic-60", service: { ...draft, duration: 3 } }, meta)).toBe(base);
    expect(applyAction(base, { type: "service/update", id: "missing", service: draft }, meta)).toBe(base);
  });

  it("makes a new treatment bookable at once, at its own length and price", () => {
    const added = reduce(base, { type: "service/add", service: draft });
    const service = added.services.at(-1)!;
    const { date, start } = freeSlot(added, needOf(service));
    const booked = reduce(added, { type: "online/book", guest, notice, serviceId: service.id, staffId: "erik", date, start });
    expect(booked.bookings.at(-1)).toMatchObject({ serviceId: service.id, duration: 75, price: 990, source: "online" });
  });

  it("edits every field and leaves existing bookings as they were", () => {
    const booking = base.bookings.find((b) => b.serviceId === "classic-60" && b.status === "booked" && b.date > today)!;
    const change: ServiceDraft = { name: "Classic massage", category: "foot", duration: 50, price: 820, description: "Shorter.", staffIds: ["anna", "erik"] };
    const { next, entry } = logged(base, { type: "service/update", id: "classic-60", service: change });
    expect(findService(next, "classic-60")).toMatchObject(change);
    expect(findService(next, "classic-60")!.recallWeeks).toBe(findService(base, "classic-60")!.recallWeeks);
    expect(next.bookings.find((b) => b.id === booking.id)).toEqual(booking);
    expect(entry.before).toContain("Classic massage 60 min");
    expect(entry.after).toContain("Classic massage · 50 min");
    expect(reduce(next, { type: "log/undo", id: entry.id }).services).toEqual(base.services);
  });

  it("adds, changes and clears the longer text and its photo", () => {
    const added = reduce(base, { type: "service/add", service: { ...draft, details: "  Warm stones.\r\n\r\n\r\nSlow strokes. ", image: "massage" } });
    const service = added.services.at(-1)!;
    expect(service).toMatchObject({ details: "Warm stones.\n\nSlow strokes.", image: "massage" });
    // Customers get the text and the photo; a treatment without them carries neither key.
    const shown = publicSalonView(added, new Date(meta.at)).services;
    expect(shown.find((s) => s.id === service.id)).toMatchObject({ details: "Warm stones.\n\nSlow strokes.", image: "massage" });
    expect(shown.find((s) => s.id === "classic-30")!.details).toBeUndefined();
    expect("details" in reduce(base, { type: "service/add", service: { ...draft, details: " \n " } }).services.at(-1)!).toBe(false);

    // An update that leaves the two fields out keeps what is stored: an older caller cannot erase them.
    const repriced = reduce(added, { type: "service/update", id: service.id, service: { ...draft, price: 1050 } });
    expect(repriced.services.at(-1)).toMatchObject({ price: 1050, details: "Warm stones.\n\nSlow strokes.", image: "massage" });
    const sameAfterJson = reduce(added, JSON.parse(JSON.stringify({ type: "service/update", id: service.id, service: { ...draft, details: undefined, image: undefined } })));
    expect(sameAfterJson.services.at(-1)).toMatchObject({ details: "Warm stones.\n\nSlow strokes.", image: "massage" });
    // Each can be changed or cleared on its own; only an explicit blank clears.
    const noPhoto = reduce(added, { type: "service/update", id: service.id, service: { ...draft, image: "" } });
    expect(noPhoto.services.at(-1)!.details).toBe("Warm stones.\n\nSlow strokes.");
    expect(noPhoto.services.at(-1)!.image).toBeUndefined();
    const cleared = reduce(added, { type: "service/update", id: service.id, service: { ...draft, details: " \n ", image: "" } });
    expect(cleared.services.at(-1)!.details).toBeUndefined();
    expect(cleared.services.at(-1)!.image).toBeUndefined();
    expect("details" in JSON.parse(JSON.stringify(cleared.services.at(-1)))).toBe(false);
    expect(reduce(added, { type: "service/update", id: service.id, service: { ...draft, details: "x".repeat(MAX_DETAILS + 1) } })).toBe(added);
    expect(reduce(added, { type: "service/update", id: service.id, service: { ...draft, image: "nope" } })).toBe(added);
    // A copy keeps the text.
    const copy = reduce(added, { type: "service/duplicate", id: service.id, name: "Hot stone massage (copy)" });
    expect(copy.services.at(-1)!.details).toBe(service.details);
  });

  it("gives two demo treatments a longer text that follows the language until the owner rewrites it", () => {
    const withDetails = base.services.filter((s) => s.details).map((s) => s.id);
    expect(withDetails).toEqual(["spa-foot-care", "classic-60"]);
    const swedish = findService(salonCopy(base, "sv"), "classic-60")!;
    expect(swedish.details).toContain("klassisk massage");
    expect(swedish.details).not.toBe(findService(base, "classic-60")!.details);
    const own = reduce(base, { type: "service/update", id: "classic-60", service: { ...findService(base, "classic-60")!, details: "Our own words." } });
    expect(findService(salonCopy(own, "sv"), "classic-60")!.details).toBe("Our own words.");
  });

  it("lets a copy of a demo treatment follow the language like the original, until the owner rewrites it", () => {
    const copied = reduce(base, { type: "service/duplicate", id: "classic-60", name: "Klassisk massage 60 min (kopia)" });
    const copy = copied.services[ids(copied).indexOf("classic-60") + 1];
    const original = findService(salonCopy(copied, "sv"), "classic-60")!;
    const swedish = findService(salonCopy(copied, "sv"), copy.id)!;
    expect(swedish).toMatchObject({ name: "Klassisk massage 60 min (kopia)", description: original.description, details: original.details });
    expect(swedish.description).not.toBe(copy.description);
    const own = reduce(copied, { type: "service/update", id: copy.id, service: { ...copy, description: "Our own words.", details: "More of our own words." } });
    expect(findService(salonCopy(own, "sv"), copy.id)).toMatchObject({ description: "Our own words.", details: "More of our own words." });
  });

  it("hides a treatment from customers without deleting it, and shows it again", () => {
    const { next, entry } = logged(base, { type: "service/visibility", id: "classic-60", hidden: true });
    expect(entry.summary).toBe("Hid Classic massage 60 min from the booking page");
    expect(next.services).toHaveLength(base.services.length);
    expect(bookableServices(next).some((s) => s.id === "classic-60")).toBe(false);
    expect(applyAction(next, { type: "service/visibility", id: "classic-60", hidden: true }, meta)).toBe(next);

    const { date, start } = freeSlot(next, { serviceId: "classic-60", duration: 60 });
    expect(reduce(next, { type: "online/book", guest, notice, serviceId: "classic-60", staffId: "erik", date, start })).toBe(next);
    expect(reduce(next, { type: "online/waitlist", guest, notice, serviceId: "classic-60" })).toBe(next);
    // The owner can still book it from the studio.
    expect(reduce(next, { type: "booking/create", customerId: "k001", serviceId: "classic-60", staffId: "erik", date, start, source: "phone" }).bookings).toHaveLength(base.bookings.length + 1);

    const shown = reduce(next, { type: "service/visibility", id: "classic-60", hidden: false });
    expect(bookableServices(shown).some((s) => s.id === "classic-60")).toBe(true);
  });

  it("shows customers a hidden treatment only on the bookings they already have", () => {
    const hidden = reduce(base, { type: "service/visibility", id: "classic-60", hidden: true });
    const view = publicView(hidden);
    expect(view.services.some((s) => s.id === "classic-60")).toBe(false);
    expect(findService(view, "classic-60")?.name).toBe("Classic massage 60 min");
    expect(publicView(base)).toBe(base);
  });

  it("duplicates a treatment right below the original, as a hidden copy with a free name", () => {
    const { next, entry } = logged(base, { type: "service/duplicate", id: "classic-60", name: "Classic massage 60 min (copy)" });
    const at = ids(next).indexOf("classic-60");
    const copy = next.services[at + 1];
    expect(copy).toMatchObject({ name: "Classic massage 60 min (copy)", hidden: true, duration: 60, category: "massage" });
    expect(copy.id).not.toBe("classic-60");
    const again = reduce(next, { type: "service/duplicate", id: "classic-60", name: "Classic massage 60 min (copy)" });
    expect(again.services[at + 1].name).toBe("Classic massage 60 min (copy) 2");
    expect(reduce(next, { type: "log/undo", id: entry.id }).services).toEqual(base.services);
    expect(reduce(base, { type: "service/duplicate", id: "missing", name: "x" })).toBe(base);
  });

  it("reorders treatments within their category and can undo it", () => {
    const [first, second] = ids(base, "massage");
    const { next, entry } = logged(base, { type: "service/move", id: second, direction: "up" });
    expect(ids(next, "massage").slice(0, 2)).toEqual([second, first]);
    expect(ids(next, "foot")).toEqual(ids(base, "foot"));
    expect(entry.summary).toBe("Reordered the price list");
    expect(isUndoable(next, entry)).toBe(true);
    expect(ids(reduce(next, { type: "log/undo", id: entry.id }))).toEqual(ids(base));
    // The first cannot go further up, the last not further down.
    expect(applyAction(base, { type: "service/move", id: first, direction: "up" }, meta)).toBe(base);
    expect(applyAction(base, { type: "service/move", id: ids(base, "massage").at(-1)!, direction: "down" }, meta)).toBe(base);
  });

  it("applies a full treatment order once and exposes it on the booking page", () => {
    const group = ids(base, "massage");
    const before = reduce(base, { type: "service/visibility", id: group[1], hidden: true });
    const order = [group.at(-1)!, ...group.slice(0, -1)];
    const { next, entry } = logged(before, { type: "service/reorder", category: "massage", ids: order });
    expect(ids(next, "massage")).toEqual(order);
    expect(ids(next, "foot")).toEqual(ids(before, "foot"));
    expect(next.log).toHaveLength(before.log.length + 1);
    expect(ids(publicView(next), "massage")).toEqual(order.filter((id) => id !== group[1]));
    expect(reduce(next, { type: "log/undo", id: entry.id }).services).toEqual(before.services);
  });

  it("rejects missing, duplicate, unknown and cross-category treatment ids", () => {
    const [first, ...rest] = ids(base, "massage");
    const invalidOrders = [rest, [rest[0], ...rest], ["unknown", ...rest], [ids(base, "foot")[0], ...rest], [first, first, ...rest]];
    for (const order of invalidOrders) {
      expect(applyAction(base, { type: "service/reorder", category: "massage", ids: order }, meta)).toBe(base);
    }
    expect(applyAction(base, { type: "service/reorder", category: "unknown", ids: [] }, meta)).toBe(base);
    expect(applyAction(base, { type: "service/reorder", category: "massage", ids: [first, ...rest] }, meta)).toBe(base);
  });
});

describe("deleting a treatment", () => {
  const usage = serviceUsage(base, "classic-60", today);

  it("counts what still uses it", () => {
    expect(usage.upcoming).toBeGreaterThan(0);
    expect(usage.past).toBeGreaterThan(0);
    expect(serviceUsage(base, "nothing", today)).toEqual({ upcoming: 0, past: 0, packages: 0, campaigns: 0 });
    const sold = reduce(base, { type: "package/sell", customerId: "k001", serviceId: "classic-60", date: today });
    expect(serviceUsage(sold, "classic-60", today).packages).toBe(1);
  });

  it("keeps every booking exactly as it was and still names the treatment", () => {
    const { next, entry } = logged(base, { type: "service/delete", id: "classic-60" });
    expect(next.services.some((s) => s.id === "classic-60")).toBe(false);
    expect(next.bookings).toEqual(base.bookings);
    expect(next.retiredServices.map((s) => s.id)).toEqual(["classic-60"]);
    expect(findService(next, "classic-60")?.name).toBe("Classic massage 60 min");
    expect(entry).toMatchObject({ summary: "Deleted the treatment Classic massage 60 min", after: `${usage.upcoming} upcoming bookings kept` });
  });

  it("no longer offers it for new bookings, in the studio or online", () => {
    const next = reduce(base, { type: "service/delete", id: "classic-60" });
    const { date, start } = freeSlot(base, { serviceId: "classic-60", duration: 60 });
    expect(reduce(next, { type: "booking/create", customerId: "k001", serviceId: "classic-60", staffId: "erik", date, start, source: "phone" })).toBe(next);
    expect(reduce(next, { type: "online/book", guest, notice, serviceId: "classic-60", staffId: "erik", date, start })).toBe(next);
  });

  it("lets a kept booking still be moved, with its room", () => {
    const next = reduce(base, { type: "service/delete", id: "classic-60" });
    const booking = next.bookings.find((b) => b.serviceId === "classic-60" && b.status === "booked" && b.date > today)!;
    let date = addDays(booking.date, 1);
    while (!freeStarts(next, booking.staffId, date, booking).length) date = addDays(date, 1);
    const moved = reduce(next, { type: "booking/move", id: booking.id, date, start: freeStarts(next, booking.staffId, date, booking)[0] });
    expect(moved.bookings.find((b) => b.id === booking.id)).toMatchObject({ date, duration: booking.duration, price: booking.price });
    expect(moved.bookings.find((b) => b.id === booking.id)!.resourceId).toBeDefined();
  });

  it("can be undone, which puts the treatment back in its place", () => {
    const { next, entry } = logged(base, { type: "service/delete", id: "classic-60" });
    const undone = reduce(next, { type: "log/undo", id: entry.id });
    expect(undone.services).toEqual(base.services);
    expect(undone.retiredServices).toEqual([]);
  });

  it("removes an unused treatment completely", () => {
    const added = reduce(base, { type: "service/add", service: draft });
    const next = reduce(added, { type: "service/delete", id: added.services.at(-1)!.id });
    expect(next.services).toEqual(base.services);
    expect(next.retiredServices).toEqual([]);
  });

  it("refuses to delete the last treatment or an unknown one", () => {
    const one = { ...base, services: base.services.slice(0, 1) };
    expect(reduce(one, { type: "service/delete", id: one.services[0].id })).toBe(one);
    expect(reduce(base, { type: "service/delete", id: "missing" })).toBe(base);
  });
});

describe("categories", () => {
  it("start as the industry pack's two, named", () => {
    expect(base.categories).toEqual([{ id: "foot", name: "Foot care" }, { id: "massage", name: "Massage" }]);
    expect(createDemoState(today, { pack: "hair" }).categories.map((c) => c.name)).toEqual(["Cuts", "Colour"]);
  });

  it("adds a category that a treatment can then use", () => {
    const { next, entry } = logged(base, { type: "category/add", name: " Add-ons " });
    const added = next.categories.at(-1)!;
    expect(added.name).toBe("Add-ons");
    expect(entry.summary).toBe("Added the category Add-ons");
    expect(serviceIssues(next, { ...draft, category: added.id })).toEqual([]);
    expect(applyAction(next, { type: "category/add", name: "add-ons" }, meta)).toBe(next);
    expect(applyAction(base, { type: "category/add", name: "" }, meta)).toBe(base);
  });

  it("renames a category without touching its treatments", () => {
    const { next, entry } = logged(base, { type: "category/rename", id: "massage", name: "Massage & body" });
    expect(next.categories[1]).toEqual({ id: "massage", name: "Massage & body" });
    expect(next.services).toBe(base.services);
    expect(entry).toMatchObject({ before: "Massage", after: undefined });
    expect(applyAction(base, { type: "category/rename", id: "massage", name: "Foot care" }, meta)).toBe(base);
    expect(applyAction(base, { type: "category/rename", id: "massage", name: "Massage" }, meta)).toBe(base);
  });

  it("removes only an empty category", () => {
    expect(applyAction(base, { type: "category/remove", id: "massage" }, meta)).toBe(base);
    const added = reduce(base, { type: "category/add", name: "Add-ons" });
    const { next, entry } = logged(added, { type: "category/remove", id: added.categories.at(-1)!.id });
    expect(next.categories).toEqual(base.categories);
    expect(entry.summary).toBe("Removed the category Add-ons");
    expect(reduce(next, { type: "log/undo", id: entry.id }).categories).toEqual(added.categories);
  });

  it("reorders categories and can undo it", () => {
    const { next, entry } = logged(base, { type: "category/move", id: "massage", direction: "up" });
    expect(next.categories.map((c) => c.id)).toEqual(["massage", "foot"]);
    expect(reduce(next, { type: "log/undo", id: entry.id }).categories).toEqual(base.categories);
    expect(applyAction(base, { type: "category/move", id: "foot", direction: "up" }, meta)).toBe(base);
  });

  it("applies a full category order once and exposes it on the booking page", () => {
    const order = ["massage", "foot"];
    const { next, entry } = logged(base, { type: "category/reorder", ids: order });
    expect(next.categories.map((category) => category.id)).toEqual(order);
    expect(next.services).toBe(base.services);
    expect(next.log).toHaveLength(base.log.length + 1);
    expect(publicView(next).categories.map((category) => category.id)).toEqual(order);
    expect(reduce(next, { type: "log/undo", id: entry.id }).categories).toEqual(base.categories);
  });

  it("rejects missing, duplicate and unknown category ids and ignores the current order", () => {
    for (const order of [["massage"], ["massage", "massage"], ["massage", "unknown"], ["foot", "massage"]]) {
      expect(applyAction(base, { type: "category/reorder", ids: order }, meta)).toBe(base);
    }
  });
});

describe("the price list elsewhere", () => {
  const added = reduce(base, { type: "service/add", service: draft });

  it("is what the assistant looks up", () => {
    const reply = lookup({ state: added, clock: { today, minutes: 600 }, context: { customerIds: [] }, owner: true }, "how much is hot stone massage?");
    expect(reply?.text).toContain("990");
  });

  it("is what a campaign picks treatments from, by name or by category name", () => {
    expect(parseCampaignRequest("20% off hot stone massage", added, today)?.serviceIds).toEqual([added.services.at(-1)!.id]);
    const renamed = reduce(added, { type: "category/rename", id: "massage", name: "Bodywork" });
    expect(parseCampaignRequest("15% off bodywork", renamed, today)?.serviceIds).toEqual(ids(renamed, "massage"));
  });
});

describe("migration to the editable price list", () => {
  it("gives a v15 save its pack's categories and keeps the owner's prices", () => {
    const fresh = createDemoState(today, { pack: "nails" });
    const saved: Partial<DemoState> = { ...fresh, version: 15, services: fresh.services.map((s, i) => (i === 0 ? { ...s, price: 1234 } : s)) };
    delete saved.categories;
    delete saved.retiredServices;
    const migrated = migrateState(JSON.parse(JSON.stringify(saved)))!;
    expect(migrated.version).toBe(DEMO_VERSION);
    expect(migrated.categories).toEqual(fresh.categories);
    expect(migrated.retiredServices).toEqual([]);
    expect(migrated.services[0].price).toBe(1234);
    expect(migrated.services.every((s) => migrated.categories.some((c) => c.id === s.category))).toBe(true);
  });
});
