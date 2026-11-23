import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import type { DemoAction } from "@/concept/actions";
import type { CampaignPoster, Customer, InboxItem } from "@/concept/data/types";
import type { Routine } from "@/concept/assistant/routines";
import { MAX_DETAILS, type ServiceDraft } from "@/concept/services/edit";
import { DEFAULT_POLICY } from "@/concept/booking/protection";
import { DEFAULT_PAGE } from "@/concept/page/config";
import { OWNER_ACTION_SCHEMAS } from "@/lib/owner-actions/schemas";
import { CHANNEL_LIMIT } from "@/concept/campaigns/channels";
import { contentOf } from "@/concept/customers/journal";
import { MAX_TICKET_QUESTION } from "@/concept/support/tickets";
import { ownerAction } from "@/lib/owner-store";
import { parseOwnerAction } from "@/lib/owner-actions/parse";
import { OWNER_ACTION_TYPES, type OwnerActionType } from "@/lib/owner-actions/types";

type Member<K extends OwnerActionType> = Extract<DemoAction, { type: K }>;
type Parsed = { [K in OwnerActionType]: z.output<(typeof OWNER_ACTION_SCHEMAS)[K]> };

// Compile-time: what a schema produces is a DemoAction member, and it accepts every member the union allows.
type NotProduced = { [K in OwnerActionType]: Parsed[K] extends Member<K> ? never : K }[OwnerActionType];
// `journal/view` is deliberately narrower over HTTP: an owner session reports its own read of one journal; staff reads and bulk loads are the server's.
type NotAccepted = { [K in Exclude<OwnerActionType, "journal/view">]: Member<K> extends Parsed[K] ? never : K }[Exclude<OwnerActionType, "journal/view">];
expectTypeOf<NotProduced>().toEqualTypeOf<never>();
expectTypeOf<NotAccepted>().toEqualTypeOf<never>();

const inboxItem: Omit<InboxItem, "id"> = { kind: "system", customerId: "k-7", date: "2026-11-22", time: 600, title: "Hello Lena", body: "Welcome back.", read: false, handled: true };
const week = { 0: null, 1: { start: 540, end: 1020 }, 2: { start: 540, end: 1020 } };
const draft: ServiceDraft = { name: "Foot care", category: "foot", duration: 45, price: 495, description: "A calm treatment.", staffIds: ["anna", "staff-3"] };
const customer: Omit<Customer, "id"> = {
  firstName: "Lena", lastName: "Example", phone: "070-123 45 67", email: "lena@example.test", category: "both", preferredStaff: "anna",
  since: "2026-11-22", birthday: "1990-05-04", isRegular: false, note: "Prefers mornings", tags: ["Imported"], waitlist: false,
};
const journal = { treatment: "Foot care", observations: "Dry skin", advice: "Moisturise", nextVisit: "In six weeks", photos: { before: "/demo/massage.webp" } };
const poster: CampaignPoster = {
  style: "price", image: "/demo/salon.webp", headline: "Foot care", detail: "A calm treatment.", textSize: "large", focus: "top", arrangement: "mirrored",
  price: "495 kr", sticker: ["Today", "22 Nov"], items: [{ name: "Foot care", price: "495 kr" }], cta: "Book now", quote: "Lovely", author: "Lena E.",
  slotDate: "2026-11-23", stars: 5, badges: ["Epassi"], before: "/demo/hair.webp", lead: "New", backdrop: "bloom", socialQr: true,
  photoTone: { light: 5, contrast: -3, warmth: 2 },
};
const routine: Routine = {
  id: "monday-reminders", name: "Monday reminders", description: "Texts due-back customers.", when: { weekdays: [1], time: "08:00" },
  steps: ["Find customers", "Draft texts"], tools: ["list_customers"], enabled: true, createdOn: "2026-11-22", lastRun: "2026-11-22 09:00",
};
const at = { date: "2026-11-22", time: 600 };

// One real payload per action type, as the studio dispatches it.
const EXAMPLES: { [K in OwnerActionType]: Member<K> } = {
  "accounting/connect": { type: "accounting/connect", on: "2026-11-22" },
  "accounting/disconnect": { type: "accounting/disconnect" },
  "booking/cancel": { type: "booking/cancel", id: "b-12", reason: "Customer asked", notice: { ...inboxItem, kind: "cancel", bookingId: "b-12", draftReply: "See you soon" } },
  "booking/complete": { type: "booking/complete", id: "b-12" },
  "booking/create": { type: "booking/create", customerId: "k-7", serviceId: "s-1", staffId: "anna", date: "2026-11-23", start: 600, source: "phone" },
  "booking/fee": { type: "booking/fee", id: "b-12", incident: "noshow", outcome: "waive", reason: "First time" },
  "booking/move": { type: "booking/move", id: "b-12", date: "2026-11-24", start: 660, staffId: "erik", notice: { ...inboxItem, kind: "reschedule", bookingId: "b-12" } },
  "campaign/ad": { type: "campaign/ad", id: "c-3", ad: { budget: 500, days: 7, radiusKm: 10 } },
  "campaign/launch": {
    type: "campaign/launch", today: "2026-11-22",
    campaign: {
      name: "Winter feet", serviceIds: ["s-1"], discountPercent: 15, from: "2026-11-23", to: "2026-12-07", channels: ["instagram", "sms"], holidayId: "h-1",
      publishOn: "2026-11-23", copy: { instagram: "Winter feet offer", sms: "Book now" }, signOff: "Warmly, Salong Eko", poster, link: "https://salongeko.example/c/winter-7k2",
    },
  },
  "card/dismiss": { type: "card/dismiss", id: "stock-st-2-2026-11-22" },
  "category/add": { type: "category/add", name: "Spa" },
  "category/move": { type: "category/move", id: "foot", direction: "down" },
  "category/remove": { type: "category/remove", id: "cat-4" },
  "category/rename": { type: "category/rename", id: "cat-4", name: "Spa care" },
  "category/reorder": { type: "category/reorder", ids: ["foot", "massage", "cat-4"] },
  "cost/add": { type: "cost/add", kind: "rent", label: "Studio rent", amount: 9500 },
  "cost/remove": { type: "cost/remove", id: "cost-4" },
  "customer/delete": { type: "customer/delete", id: "k-7" },
  "customer/note": { type: "customer/note", id: "k-7", note: "Prefers Erik" },
  "customer/update": { type: "customer/update", id: "k-7", patch: { firstName: "Lena", phone: "070-123 45 68", birthday: null, tags: ["Regular"], waitlist: false } },
  "booking/update": { type: "booking/update", id: "b-12", patch: { contactEmail: "lena@example.test", note: null } },
  "customer/keep": { type: "customer/keep", id: "k-7", on: "2026-11-22" },
  "journal/view": { type: "journal/view", customerId: "k-7", actor: "owner" },
  "privacy/journal-retention": { type: "privacy/journal-retention", years: 5 },
  "customers/import": { type: "customers/import", customers: [customer] },
  "customers/message": { type: "customers/message", texts: [{ customerId: "k-7", title: "Time for a visit", body: "It has been six weeks.", recallServiceId: "s-1" }], at },
  "giftcard/redeem": { type: "giftcard/redeem", code: "EKO-7K2Q-93XD", bookingId: "b-12", date: "2026-11-22" },
  "giftcard/sell": { type: "giftcard/sell", amount: 500, recipient: "Lena", message: "Enjoy", date: "2026-11-22" },
  "inbox/add": { type: "inbox/add", item: { ...inboxItem, waitlistOffer: true, recallServiceId: "s-1" } },
  "inbox/read": { type: "inbox/read", id: "i-4" },
  "inbox/read-all": { type: "inbox/read-all" },
  "inbox/reply": { type: "inbox/reply", id: "i-4", reply: "Yes, that works", slot: { staffId: "anna", serviceId: "s-1", date: "2026-11-23", start: 600 } },
  "journal/add": { type: "journal/add", entry: { customerId: "k-7", date: "2026-11-22", staffId: "anna", ...journal } },
  "journal/edit": { type: "journal/edit", id: "j-2", content: journal, on: "2026-11-22" },
  "log/undo": { type: "log/undo", id: "log-9" },
  "memory/add": { type: "memory/add", item: { text: "Closed on Midsummer Eve", kind: "fact", savedOn: "2026-11-22", source: "owner", customerId: "k-7", staffId: "erik" } },
  "memory/edit": { type: "memory/edit", id: "m-2", text: "Closed on Midsummer" },
  "memory/forget": { type: "memory/forget", id: "m-2" },
  "module/preset": { type: "module/preset", preset: "essentials" },
  "module/toggle": { type: "module/toggle", key: "stock" },
  "package/sell": { type: "package/sell", customerId: "k-7", serviceId: "s-1", date: "2026-11-22" },
  "page/set": {
    type: "page/set",
    page: {
      ...DEFAULT_PAGE, instagram: "@salong.eko", css: ".booking-theme h1 { letter-spacing: 1px; }",
      theme: { logo: null, logoColors: ["#2f5d50"], colors: { background: "#f7f4ef", text: "#212522", accent: "#2f5d50" }, fonts: "classic", corners: "round", style: "lined", heroPhoto: "massage" },
    },
  },
  "product/sell": { type: "product/sell", customerId: "k-7", stockId: "st-2", quantity: 2, date: "2026-11-22" },
  "reminder/settings": { type: "reminder/settings", settings: { channel: "sms", smsPriceOre: 45 } },
  "resource/add": { type: "resource/add", name: "Room 2", kind: "room" },
  "resource/remove": { type: "resource/remove", id: "res-2" },
  "resource/rename": { type: "resource/rename", id: "res-2", name: "Quiet room" },
  "review/approve": { type: "review/approve", id: "r-5" },
  "review/reply": { type: "review/reply", id: "r-5", reply: "Thank you!" },
  "routine/add": { type: "routine/add", routine },
  "routine/ran": { type: "routine/ran", id: "monday-reminders", at: "2026-11-23 08:00" },
  "routine/toggle": { type: "routine/toggle", id: "monday-reminders", at: "2026-11-22 09:00" },
  "salon/close": { type: "salon/close", date: "2026-12-24", name: "Christmas Eve" },
  "salon/details": { type: "salon/details", details: { name: "Salong Eko", phone: "08-123 45 67", email: "hello@salongeko.example", address: "Exempelgatan 1", area: "Södermalm" } },
  "salon/hours": { type: "salon/hours", hours: { 0: null, 1: { open: 540, close: 1020 }, 2: { open: 540, close: 1020 } }, lunch: { start: 720, end: 780 } },
  "salon/language": { type: "salon/language", language: "sv", bilingual: true },
  "salon/policy": { type: "salon/policy", policy: { ...DEFAULT_POLICY, freeHours: 48, latePercent: 50, deposits: { "s-1": 10000 }, exemptServices: ["s-2"] } },
  "salon/reopen": { type: "salon/reopen", id: "cl-3" },
  "salon/slug": { type: "salon/slug", slug: "salong-eko" },
  "service/add": { type: "service/add", service: draft },
  "service/delete": { type: "service/delete", id: "s-1" },
  "service/duplicate": { type: "service/duplicate", id: "s-1", name: "Foot care (copy)" },
  "service/move": { type: "service/move", id: "s-1", direction: "up" },
  "service/price": { type: "service/price", id: "s-1", price: 495.5 },
  "service/recall": { type: "service/recall", id: "s-1", weeks: 8 },
  "service/reorder": { type: "service/reorder", category: "foot", ids: ["s-1", "s-2"] },
  "service/resources": { type: "service/resources", id: "s-1", resourceIds: ["res-1", "res-2"] },
  "service/update": { type: "service/update", id: "s-1", service: draft },
  "service/visibility": { type: "service/visibility", id: "s-1", hidden: true },
  "staff/block": { type: "staff/block", staffId: "anna", date: "2026-11-23", start: 720, end: 780, reason: "break" },
  "staff/exception-remove": { type: "staff/exception-remove", id: "ex-4" },
  "staff/off": { type: "staff/off", staffId: "erik", dates: ["2026-11-23", "2026-11-24"], reason: "vacation" },
  "staff/shift": { type: "staff/shift", staffId: "erik", date: "2026-11-23", start: 600, end: 960 },
  "staff/week": { type: "staff/week", staffId: "anna", week },
  "stock/adjust": { type: "stock/adjust", id: "st-2", delta: -1 },
  "stock/order": {
    type: "stock/order", at,
    orders: [{ supplier: "Nordic Care", lines: [{ stockId: "st-2", quantity: 6, unitCost: 42.5 }], email: { title: "Order to Nordic Care", body: "Please send 6 tubes." } }],
  },
  "stock/receive": { type: "stock/receive", orderId: "o-3", deliveries: [{ stockId: "st-2", quantity: 6 }], date: "2026-11-25" },
  "stock/update": { type: "stock/update", id: "st-2", patch: { reorderAt: 3, unitCost: 40, supplier: "Nordic Care", salePrice: 120 } },
  "support/grant": { type: "support/grant", hours: 24, at: 1_790_000_000_000 },
  "support/revoke": { type: "support/revoke", at: 1_790_000_100_000 },
  "ticket/create": {
    type: "ticket/create",
    ticket: {
      createdAt: 1_790_000_000_000, question: "How do I move a visit?", path: "/studio/calendar", requestId: "5b0f6a3e-9f64-4c0e-8f1d-2f0d3b8f6a11",
      screen: ["Calendar", "New booking"], activity: [{ at: 1_789_999_000_000, actor: "owner", summary: "Moved a visit" }],
    },
  },
  "trash/restore": { type: "trash/restore", id: "tr-2" },
};

const parse = (value: unknown) => parseOwnerAction(JSON.parse(JSON.stringify(value)));
const send = (type: OwnerActionType, change: (action: Record<string, unknown>) => void) => {
  const action = JSON.parse(JSON.stringify(EXAMPLES[type]));
  change(action);
  return parseOwnerAction(action);
};

describe("owner action schemas", () => {
  it("has a schema for exactly the allowed types", () => {
    expect(Object.keys(OWNER_ACTION_SCHEMAS).sort()).toEqual([...OWNER_ACTION_TYPES].sort());
    expect(Object.keys(EXAMPLES).sort()).toEqual([...OWNER_ACTION_TYPES].sort());
  });

  it.each(OWNER_ACTION_TYPES)("round-trips a real %s payload", (type) => {
    expect(parse(EXAMPLES[type])).toEqual(JSON.parse(JSON.stringify(EXAMPLES[type])));
  });

  it("accepts the other ways to book", () => {
    const base = { type: "booking/create", serviceId: "s-1", staffId: "anna", date: "2026-11-23", start: 600 } as const;
    const online = { ...base, id: "7c6f1f0e-4e9a-4c8c-9a53-4a5b6c7d8e9f", newCustomer: { name: "Lena Example", phone: "070-123 45 67", email: "", since: "2026-11-22" }, source: "phone" };
    const assistant = { ...base, fictionalCustomer: { id: "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f", name: "Sam Example", since: "2026-11-22" }, source: "assistant" };
    expect(parse(online)).toEqual(online);
    expect(parse(assistant)).toEqual(assistant);
    expect(parse({ ...assistant, source: "phone" })).toBeNull();
  });

  it("keeps the studio's own id namespaces for the studio", () => {
    for (const id of ["b-12", "k-7", "booking-1", "not-a-uuid"]) {
      expect(send("booking/create", (action) => { action.id = id; }), id).toBeNull();
    }
    expect(send("booking/create", (action) => { action.id = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f"; })).not.toBeNull();
    const fictional = { ...EXAMPLES["booking/create"], customerId: undefined, source: "assistant", fictionalCustomer: { id: "k-90", name: "Sam Example", since: "2026-11-22" } };
    expect(parse(fictional)).toBeNull();
  });

  it("does not let an owner write the sender's delivery record", () => {
    const notice = { ...inboxItem, delivery: { channel: "sms", kind: "confirmation", slot: "2026-11-23:600:anna" } };
    expect(parse({ type: "inbox/add", item: notice })).toBeNull();
    expect(send("booking/cancel", (action) => { (action.notice as Record<string, unknown>).delivery = notice.delivery; })).toBeNull();
  });

  it("accepts the whole stored journal entry only as its five content fields", () => {
    const stored = { id: "j-2", customerId: "k-7", date: "2026-11-22", staffId: "anna", versions: [], ...journal };
    expect(parse({ type: "journal/edit", id: "j-2", content: stored, on: "2026-11-23" })).toBeNull();
    expect(parse({ type: "journal/edit", id: "j-2", content: contentOf(stored), on: "2026-11-23" })).not.toBeNull();
  });

  it("allows the longest caption each channel allows and no more", () => {
    const campaign = (copy: Record<string, string>) => send("campaign/launch", (action) => { (action.campaign as Record<string, unknown>).copy = copy; });
    expect(campaign({ instagram: "x".repeat(CHANNEL_LIMIT.instagram), sms: "x".repeat(CHANNEL_LIMIT.sms) })).not.toBeNull();
    expect(campaign({ instagram: "x".repeat(CHANNEL_LIMIT.instagram + 1) })).toBeNull();
    expect(campaign({ sms: "x".repeat(CHANNEL_LIMIT.sms + 1) })).toBeNull();
  });

  it("allows the longest support question the form allows", () => {
    const ticket = (question: string) => send("ticket/create", (action) => { (action.ticket as Record<string, unknown>).question = question; });
    expect(ticket("q".repeat(MAX_TICKET_QUESTION))).not.toBeNull();
    expect(ticket("q".repeat(MAX_TICKET_QUESTION + 1))).toBeNull();
  });

  it("refuses text PostgreSQL cannot store", () => {
    expect(send("customer/note", (action) => { action.note = "lone \ud800 surrogate"; })).toBeNull();
    expect(send("customer/note", (action) => { action.note = "pair \ud83d\ude00 is fine"; })).not.toBeNull();
  });

  it("refuses impossible routine stamps and times", () => {
    for (const at of ["2026-02-30 08:00", "2026-11-23 24:00", "2026-11-23 08:60", "2026-11-23"]) {
      expect(send("routine/ran", (action) => { action.at = at; }), at).toBeNull();
    }
    expect(send("routine/ran", (action) => { action.at = "2026-11-23 23:59"; })).not.toBeNull();
    expect(send("routine/add", (action) => { ((action.routine as { when: Record<string, unknown> }).when).time = "24:00"; })).toBeNull();
    expect(send("routine/add", (action) => { (action.routine as Record<string, unknown>).lastRun = "2026-13-01 09:00"; })).toBeNull();
  });

  it("refuses stock lines that claim goods already arrived", () => {
    expect(send("stock/order", (action) => { ((action.orders as { lines: Record<string, unknown>[] }[])[0].lines[0]).received = 6; })).toBeNull();
  });

  it("refuses a policy with too many deposits", () => {
    const deposits = Object.fromEntries(Array.from({ length: 201 }, (_, index) => [`s-${index}`, 100]));
    expect(send("salon/policy", (action) => { (action.policy as Record<string, unknown>).deposits = deposits; })).toBeNull();
  });

  it("refuses an extra field", () => {
    for (const type of ["booking/move", "service/price", "cost/add", "page/set", "salon/policy", "stock/update", "inbox/read-all"] as const) {
      expect(send(type, (action) => { action.extra = 1; }), type).toBeNull();
    }
    expect(send("page/set", (action) => { (action.page as Record<string, unknown>).owner = "x"; })).toBeNull();
    expect(send("campaign/launch", (action) => { (action.campaign as Record<string, unknown>).status = "ended"; })).toBeNull();
    expect(send("booking/cancel", (action) => { (action.notice as Record<string, unknown>).id = "i-1"; })).toBeNull();
  });

  it("refuses a wrong type", () => {
    expect(send("booking/move", (action) => { action.start = "600"; })).toBeNull();
    expect(send("service/visibility", (action) => { action.hidden = "yes"; })).toBeNull();
    expect(send("category/reorder", (action) => { action.ids = "foot"; })).toBeNull();
    expect(send("customer/note", (action) => { action.note = { text: "x" }; })).toBeNull();
    expect(send("staff/week", (action) => { action.week = []; })).toBeNull();
  });

  it("refuses an oversized string or list", () => {
    expect(send("customer/note", (action) => { action.note = "x".repeat(2001); })).toBeNull();
    expect(send("resource/add", (action) => { action.name = "x".repeat(121); })).toBeNull();
    expect(send("booking/cancel", (action) => { action.id = "b".repeat(81); })).toBeNull();
    expect(send("category/reorder", (action) => { action.ids = Array.from({ length: 201 }, (_, index) => `c-${index}`); })).toBeNull();
    expect(send("page/set", (action) => { (action.page as Record<string, unknown>).css = "a".repeat(8001); })).toBeNull();
    expect(send("review/reply", (action) => { action.reply = "bad\u0000text"; })).toBeNull();
  });

  it("refuses ids of another kind", () => {
    expect(send("booking/complete", (action) => { action.id = "b-1; DROP TABLE"; })).toBeNull();
    expect(send("booking/complete", (action) => { action.id = ""; })).toBeNull();
    expect(send("booking/move", (action) => { action.staffId = "owner"; })).toBeNull();
    expect(send("module/toggle", (action) => { action.key = "billing"; })).toBeNull();
  });

  it("refuses a negative, fractional or out-of-range amount", () => {
    expect(send("cost/add", (action) => { action.amount = -5; })).toBeNull();
    expect(send("giftcard/sell", (action) => { action.amount = 250.5; })).toBeNull();
    // Costs are typed by hand and may have decimals; the reducer rounds them.
    expect(send("cost/add", (action) => { action.amount = 99.5; })).not.toBeNull();
    expect(send("giftcard/sell", (action) => { action.amount = 99; })).toBeNull();
    expect(send("giftcard/sell", (action) => { action.amount = 10_001; })).toBeNull();
    expect(send("service/price", (action) => { action.price = -1; })).toBeNull();
    expect(send("service/price", (action) => { action.price = 100_001; })).toBeNull();
    expect(send("product/sell", (action) => { action.quantity = -1; })).toBeNull();
    expect(send("booking/move", (action) => { action.start = 1441; })).toBeNull();
    expect(send("staff/shift", (action) => { action.start = -1; })).toBeNull();
    expect(send("reminder/settings", (action) => { action.settings = { smsPriceOre: 100_000 }; })).toBeNull();
    expect(send("service/recall", (action) => { action.weeks = 27; })).toBeNull();
  });

  it("refuses a bad date", () => {
    expect(send("accounting/connect", (action) => { action.on = "2026-02-30"; })).toBeNull();
    expect(send("accounting/connect", (action) => { action.on = "22/11/2026"; })).toBeNull();
    expect(send("booking/move", (action) => { action.date = "2026-13-01"; })).toBeNull();
    expect(send("staff/off", (action) => { action.dates = ["2026-11-23", "tomorrow"]; })).toBeNull();
    expect(send("staff/off", (action) => { action.dates = Array.from({ length: 367 }, () => "2026-11-23"); })).toBeNull();
  });

  it("refuses prototype keys anywhere", () => {
    for (const key of ["__proto__", "constructor", "prototype"]) {
      const top = JSON.parse(`{"type":"inbox/read","id":"i-4","${key}":{"polluted":true}}`);
      expect(parseOwnerAction(top), key).toBeNull();
      const nested = JSON.parse(`{"type":"salon/policy","policy":{"version":1,"freeHours":24,"latePercent":0,"noShowPercent":0,"newCustomersOnly":false,"exemptServices":[],"deposits":{"${key}":1}}}`);
      expect(parseOwnerAction(nested), key).toBeNull();
    }
    expect(send("staff/week", (action) => { action.week = JSON.parse('{"__proto__":{"start":1,"end":2}}'); })).toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("applies the domain rules the reducer already has", () => {
    expect(send("salon/policy", (action) => { (action.policy as Record<string, unknown>).latePercent = 101; })).toBeNull();
    expect(send("page/set", (action) => { ((action.page as { theme: Record<string, unknown> }).theme).logo = "javascript:alert(1)"; })).toBeNull();
    expect(send("page/set", (action) => { ((action.page as { sections: unknown[] }).sections) = [{ kind: "hero", variant: "huge" }]; })).toBeNull();
    expect(send("page/set", (action) => { ((action.page as { theme: Record<string, unknown> }).theme).colors = { background: "red", text: "#000000", accent: "#ffffff" }; })).toBeNull();
    expect(send("salon/slug", (action) => { action.slug = "Salong Eko"; })).toBeNull();
    expect(send("salon/details", (action) => { (action.details as Record<string, unknown>).name = "x".repeat(61); })).toBeNull();
    expect(send("service/add", (action) => { (action.service as Record<string, unknown>).duration = 7; })).toBeNull();
  });

  it("accepts the treatment editor's whole draft, with the longer text, photo and timing, and nothing beyond their limits", () => {
    // What the sheet sends for a treatment with every optional field filled in, as it arrives over HTTP.
    const full = { ...draft, details: "First.\n\nSecond.", image: "massage", bufferBefore: 5, bufferAfter: 10, processing: { after: 10, duration: 20 } };
    for (const type of ["service/add", "service/update"] as const) {
      const sent = JSON.parse(JSON.stringify({ ...EXAMPLES[type], service: full }));
      expect(parseOwnerAction(sent)).toEqual(sent);
      // Blank text and photo are how the owner clears them; zero buffers are what an empty field sends.
      const blank = JSON.parse(JSON.stringify({ ...EXAMPLES[type], service: { ...draft, details: "", image: "", bufferBefore: 0, bufferAfter: 0 } }));
      expect(parseOwnerAction(blank)).toEqual(blank);
      const edit = (change: (service: Record<string, unknown>) => void) => send(type, (action) => { action.service = { ...full }; change(action.service as Record<string, unknown>); });
      expect(edit(() => {})).not.toBeNull();
      expect(edit((service) => { service.details = "x".repeat(MAX_DETAILS + 1); })).toBeNull();
      expect(edit((service) => { service.details = 5; })).toBeNull();
      expect(edit((service) => { service.details = "nul\0"; })).toBeNull();
      for (const image of ["https://example.test/a.jpg", "data:image/png;base64,AAAA", "nope", 5, null]) expect(edit((service) => { service.image = image; })).toBeNull();
      expect(edit((service) => { service.bufferBefore = 7; })).toBeNull();
      expect(edit((service) => { service.bufferAfter = 125; })).toBeNull();
      expect(edit((service) => { service.processing = { after: 10, duration: 0 }; })).toBeNull();
      expect(edit((service) => { service.processing = { after: 10, duration: 20, extra: 1 }; })).toBeNull();
      expect(edit((service) => { service.recallWeeks = 3; })).toBeNull();
    }
  });

  it("refuses what is not an object of an allowed type", () => {
    for (const value of [null, undefined, "inbox/read", 7, [], {}, { type: "online/book" }, { type: "customer/erase", id: "k-7" }, { type: 5 }]) {
      expect(parseOwnerAction(value)).toBeNull();
    }
  });

  it("is what ownerAction returns, after the size limit", () => {
    expect(ownerAction(JSON.parse(JSON.stringify(EXAMPLES["booking/move"])))).toEqual(EXAMPLES["booking/move"]);
    expect(ownerAction({ type: "booking/move", id: "b-1" })).toBeNull();
    expect(ownerAction({ type: "customer/note", id: "k-7", note: "x".repeat(70_000) })).toBeNull();
  });
});

describe("customer rights actions are strict", () => {
  it("lets booking/update carry only the three text fields, never status, price, time, staff or money", () => {
    const base = { type: "booking/update", id: "b-12" };
    expect(ownerAction({ ...base, patch: { contactEmail: "a@example.test", note: null, cancelReason: "Ill" } })).not.toBeNull();
    for (const field of ["status", "price", "date", "start", "duration", "staffId", "serviceId", "customerId", "protection", "source", "resourceId", "publicRef", "id"]) {
      expect(ownerAction({ ...base, patch: { [field]: "x" } }), field).toBeNull();
    }
    expect(ownerAction({ ...base, patch: {}, status: "completed" })).toBeNull();
    expect(ownerAction({ ...base, patch: { note: "x".repeat(501) } })).toBeNull();
    expect(ownerAction({ ...base, patch: { contactEmail: "x".repeat(255) } })).toBeNull();
  });

  it("lets customer/update carry only the card's own fields", () => {
    const base = { type: "customer/update", id: "k-7" };
    expect(ownerAction({ ...base, patch: { firstName: "Lena", birthday: null, tags: ["a"] } })).not.toBeNull();
    for (const field of ["id", "since", "example", "keptOn", "earlier", "note"]) expect(ownerAction({ ...base, patch: { [field]: "x" } }), field).toBeNull();
    expect(ownerAction({ ...base, patch: { firstName: "" } })).toBeNull();
    expect(ownerAction({ ...base, patch: { tags: Array.from({ length: 21 }, (_, i) => `t${i}`) } })).toBeNull();
  });

  it("accepts a journal read only as the owner's own, of one customer", () => {
    expect(ownerAction({ type: "journal/view", customerId: "k-7", actor: "owner" })).not.toBeNull();
    expect(ownerAction({ type: "journal/view", actor: "owner" })).toBeNull();
    expect(ownerAction({ type: "journal/view", customerId: "k-7", actor: "staff" })).toBeNull();
    expect(ownerAction({ type: "journal/view", customerId: "k-7", actor: "owner", staffId: "erik" })).toBeNull();
  });
});
