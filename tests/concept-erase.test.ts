import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { reduce, type DemoAction } from "@/concept/actions";
import type { OutboxEntry } from "@/concept/connections/simulated/outbox";
import { customerIdentifiers, eraseCustomer, REDACTED, scrubDeep } from "@/concept/customers/erase";
import { addDays } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import type { Customer, DemoState } from "@/concept/data/types";
import { applyAction } from "@/concept/log/capture";
import type { LogMeta } from "@/concept/log/types";
import { PERSONAL_FIELDS, redactAction, redactEffectPayload } from "@/concept/store/erasure";
import { purgeExpired, TRASH_DAYS } from "@/concept/trash/trash";

// Erasure of a customer from the document (customer/erase) and the redaction
// helpers the Postgres store uses for its log and outbox. Fictional data only.

const today = "2026-11-16";
const meta: LogMeta = { actor: "owner", source: "button", at: 0 };
const base = createDemoState(today);
const guest = { firstName: "Fictional", lastName: "Erasable", phone: "0700001234", email: "erasable@example.test" };

/** The demo state with one more customer who has a booking, a note, a journal entry, an inbox item and a memory. */
function withGuest(): { state: DemoState; customer: Customer } {
  const id = "k-erase";
  const customer: Customer = {
    ...guest, id, category: base.customers[0].category, preferredStaff: base.staff[0].id, since: today, isRegular: false, tags: [], waitlist: false,
  };
  let state: DemoState = { ...base, customers: [...base.customers, customer] };
  const upcoming = base.bookings.find((b) => b.status === "booked" && b.date > today)!;
  state = applyAction(state, { type: "booking/cancel", id: upcoming.id }, meta);
  state = applyAction(state, {
    type: "booking/create", customerId: id, serviceId: upcoming.serviceId, staffId: upcoming.staffId, date: upcoming.date, start: upcoming.start, source: "phone",
  }, meta);
  state = applyAction(state, { type: "customer/note", id, note: "Fictional note: prefers mornings" }, meta);
  state = applyAction(state, {
    type: "journal/add", entry: { customerId: id, date: today, staffId: base.staff[0].id, treatment: "Fictional treatment", observations: "Fictional skin note", advice: "Rest" },
  }, meta);
  state = applyAction(state, {
    type: "inbox/add", item: { kind: "message", customerId: id, date: today, time: 600, title: "Fictional Erasable", body: "Call 0700001234", read: false, handled: false },
  }, meta);
  state = { ...state, memory: [{ id: "m-x", text: "Fictional Erasable likes tea", kind: "fact", savedOn: today } as DemoState["memory"][number], ...state.memory] };
  return { state, customer };
}

const hits = (value: unknown) => {
  const text = JSON.stringify(value).toLowerCase();
  return ["Fictional Erasable", guest.phone, "700001234", guest.email].filter((needle) => text.includes(needle.toLowerCase()));
};

describe("customer/erase", () => {
  it("removes a live customer, their records and every trace in the log", () => {
    const { state, customer } = withGuest();
    expect(hits(state).length).toBeGreaterThan(0);
    const erased = applyAction(state, { type: "customer/erase", id: customer.id }, meta);
    expect(hits(erased)).toEqual([]);
    expect(erased.customers.some((c) => c.id === customer.id)).toBe(false);
    for (const key of ["bookings", "journals", "inbox", "sales", "reviews", "packages"] as const) {
      expect(erased[key].some((item: { customerId?: string }) => item.customerId === customer.id)).toBe(false);
    }
    // Other customers and their records are untouched.
    expect(erased.customers).toHaveLength(base.customers.length);
    expect(erased.bookings.filter((b) => b.customerId !== customer.id)).toEqual(state.bookings.filter((b) => b.customerId !== customer.id));
    // Entries that named the customer read "someone" and lost their undo data; the erasure itself names nobody and cannot be undone.
    const [entry, ...older] = erased.log;
    expect(entry).toMatchObject({ type: "customer/erase", summary: "Erased a customer's personal data" });
    expect(entry.patch).toBeUndefined();
    const note = older.find((e) => e.type === "customer/note")!;
    expect(note.summary).toBe("Changed the note on someone");
    expect(note.patch).toBeUndefined();
    expect(reduce(erased, { type: "log/undo", id: entry.id })).toBe(erased);
    expect(reduce(erased, { type: "log/undo", id: note.id })).toBe(erased);
  });

  it("keeps unrelated log entries undoable", () => {
    const { state, customer } = withGuest();
    const erased = applyAction(state, { type: "customer/erase", id: customer.id }, meta);
    const cancel = erased.log.find((e) => e.type === "booking/cancel")!;
    expect(cancel.patch).toBeDefined();
    const undone = reduce(erased, { type: "log/undo", id: cancel.id });
    expect(undone).not.toBe(erased);
  });

  it("erases a customer who is already in the trash, with the trash entries of their bookings", () => {
    const { state, customer } = withGuest();
    const deleted = applyAction(state, { type: "customer/delete", id: customer.id }, meta);
    expect(deleted.trash.some((e) => e.kind === "customer" && e.customer.id === customer.id)).toBe(true);
    expect(hits(deleted).length).toBeGreaterThan(0);
    const erased = applyAction(deleted, { type: "customer/erase", id: customer.id }, meta);
    expect(hits(erased)).toEqual([]);
    expect(erased.trash.some((e) => e.kind === "customer" && e.customer.id === customer.id)).toBe(false);
    // The soft delete can no longer be undone from the log: the customer is gone for good.
    const deletion = erased.log.find((e) => e.type === "customer/delete")!;
    expect(deletion.patch).toBeUndefined();
    expect(reduce(erased, { type: "log/undo", id: deletion.id })).toBe(erased);
  });

  it("drops checkout holds made with the customer's phone", () => {
    const { state, customer } = withGuest();
    const hold = { ...base.checkoutHolds[0], id: "hold-x", guest: { name: "Fictional Erasable", phone: "070-000 12 34", at: { date: today, time: 600 } } };
    const held = { ...state, checkoutHolds: [hold as DemoState["checkoutHolds"][number]] };
    expect(eraseCustomer(held, customer.id).checkoutHolds).toEqual([]);
  });

  it("changes nothing for an unknown customer", () => {
    expect(reduce(base, { type: "customer/erase", id: "nobody" })).toBe(base);
  });

  it("erases a deleted customer for good when their trash entry expires", () => {
    const { state, customer } = withGuest();
    const deleted = applyAction(state, { type: "customer/delete", id: customer.id }, meta);
    expect(purgeExpired(deleted, addDays(today, TRASH_DAYS - 1)).trash).toEqual(deleted.trash);
    const purged = purgeExpired(deleted, addDays(today, TRASH_DAYS));
    expect(hits(purged)).toEqual([]);
    const deletion = purged.log.find((e) => e.type === "customer/delete")!;
    expect(reduce(purged, { type: "log/undo", id: deletion.id })).toBe(purged);
  });
});

describe("identifiers and scrubbing", () => {
  it("skips identifiers too short to scrub safely and orders the rest longest first", () => {
    expect(customerIdentifiers({ id: "k", firstName: "Al", lastName: "", phone: "0701", email: "" })).toEqual([]);
    expect(customerIdentifiers({ id: "k", ...guest })).toEqual(["erasable@example.test", "Fictional Erasable", "0700001234", "700001234"]);
  });

  it("replaces identifiers case-insensitively and keeps unchanged parts", () => {
    const value = { a: "Hi FICTIONAL ERASABLE", b: { c: "nothing here" }, d: ["0700001234"] };
    const scrubbed = scrubDeep(value, customerIdentifiers({ id: "k", ...guest }));
    expect(scrubbed).toEqual({ a: `Hi ${REDACTED}`, b: { c: "nothing here" }, d: [REDACTED] });
    expect(scrubbed.b).toBe(value.b);
  });
});

describe("redaction map", () => {
  it("redacts the personal fields of an action and leaves the rest", () => {
    const hold: DemoAction = {
      type: "online/hold", serviceId: "s1", staffId: base.staff[0].id, date: today, start: 600,
      guest: { name: "Fictional Erasable", phone: guest.phone, at: { date: today, time: 500 } },
      notice: { title: "Fictional request", body: "Fictional body" },
    };
    expect(redactAction(hold)).toEqual({
      ...hold, guest: { name: REDACTED, phone: REDACTED, at: hold.guest.at }, notice: { title: REDACTED, body: REDACTED },
    });
    const message: DemoAction = {
      type: "customers/message", at: { date: today, time: 600 },
      texts: [{ customerId: "k-1", title: "Fictional", body: "One" }, { customerId: "k-2", title: "Fictional", body: "Two" }],
    };
    expect(redactAction(message)).toEqual({ ...message, texts: message.texts.map((text) => ({ ...text, title: REDACTED, body: REDACTED })) });
    const dismiss: DemoAction = { type: "card/dismiss", id: "c1" };
    expect(redactAction(dismiss)).toEqual(dismiss);
  });

  it("redacts a message's recipient and text but keeps a payment's amount and reference", () => {
    const ids = customerIdentifiers({ id: "k", ...guest });
    const sms: OutboxEntry = { id: "o1", port: "sms", action: "send", to: guest.phone, body: "Hi Fictional Erasable", reference: "b-1", cost: null };
    expect(redactEffectPayload(sms, ids)).toEqual({ ...sms, to: REDACTED, body: REDACTED });
    const pay: OutboxEntry = { id: "o2", port: "payments", action: "checkout", body: "Deposit", reference: "b-1", cost: { amountMinor: 20_000, currency: "SEK" } };
    expect(redactEffectPayload(pay, ids)).toEqual(pay);
  });

  it("is identical to the map in the SECURITY DEFINER erase_subject", () => {
    const sql = readFileSync(new URL("../prisma/grants/erase-subject.sql", import.meta.url), "utf8");
    const literal = sql.match(/-- PERSONAL_FIELDS BEGIN[^\n]*\n\s*v_fields constant jsonb := '([\s\S]*?)';\n\s*-- PERSONAL_FIELDS END/);
    expect(literal).not.toBeNull();
    expect(JSON.parse(literal![1])).toEqual(JSON.parse(JSON.stringify(PERSONAL_FIELDS)));
  });
});
