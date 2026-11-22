import { describe, expect, it } from "vitest";
import { parseCsv } from "@/concept/customers/csv";
import { eraseCustomer } from "@/concept/customers/erase";
import { customerExport, customerExportCsv, customerExportFilename, customerExportJson, EXPORT_FORMAT } from "@/concept/customers/export";
import { CUSTOMER_FIELD_EDITS, correctedCustomer, updateBooking, updateCustomer, type CustomerPatch } from "@/concept/customers/rights";
import { createDemoState } from "@/concept/data/generate";
import type { Customer, DemoState } from "@/concept/data/types";
import { applyAction } from "@/concept/log/capture";
import type { LogMeta } from "@/concept/log/types";

// Customer rights in the studio: export (art. 15, 20), correction (art. 16) and
// what erasure (art. 17) removes. Fictional data only; every date is fixed.

const today = "2026-11-16";
const meta: LogMeta = { actor: "owner", source: "button", at: 1_795_000_000_000 };
const base = createDemoState(today);

const lena = { firstName: "Lena", lastName: "Exportsson", phone: "0700001111", email: "lena.exportsson@example.test" };
const olle = { firstName: "Olle", lastName: "Annanperson", phone: "0700002222", email: "olle.annanperson@example.test" };

function customer(id: string, who: typeof lena, extra: Partial<Customer> = {}): Customer {
  return { ...who, id, category: base.customers[0].category, preferredStaff: base.staff[0].id, since: "2025-01-10", isRegular: false, tags: ["Fictional tag"], waitlist: true, birthday: "1990-05-04", note: `Note about ${who.firstName} ${who.lastName}`, ...extra };
}

/** Two customers with records in every list the erasure touches. */
function richState(): { state: DemoState; mine: Customer; theirs: Customer } {
  const mine = customer("k-lena", lena);
  const theirs = customer("k-olle", olle);
  let state: DemoState = { ...base, customers: [...base.customers, mine, theirs] };
  const [slot, otherSlot] = base.bookings.filter((b) => b.status === "booked" && b.date > today);
  for (const [id, free] of [[mine.id, slot], [theirs.id, otherSlot]] as const) {
    state = applyAction(state, { type: "booking/cancel", id: free.id }, meta);
    state = applyAction(state, { type: "booking/create", customerId: id, serviceId: free.serviceId, staffId: free.staffId, date: free.date, start: free.start, source: "phone" }, meta);
  }
  const visit = (id: string) => state.bookings.find((b) => b.customerId === id)!;
  const terms = { version: 1, freeHours: 24, latePercent: 0, noShowPercent: 0, currency: "SEK", priceMinor: 49500, depositMinor: 0 };
  state = { ...state, bookings: state.bookings.map((b) => (b.customerId === mine.id ? { ...b, contactEmail: "lena.visit@example.test", note: "Fictional visit note", protection: { terms } } : b)) };
  for (const who of [mine, theirs]) {
    state = applyAction(state, { type: "journal/add", entry: { customerId: who.id, bookingId: visit(who.id).id, date: today, staffId: base.staff[0].id, treatment: `Treatment for ${who.firstName}`, observations: "Fictional observation", advice: "Rest" } }, meta);
    state = applyAction(state, { type: "inbox/add", item: { kind: "system", customerId: who.id, date: today, time: 600, title: `Confirmation for ${who.firstName}`, body: "Your visit is booked.", read: false, handled: true, delivery: { channel: "sms", kind: "confirmation", slot: "x" } } }, meta);
    state = applyAction(state, { type: "inbox/add", item: { kind: "message", customerId: who.id, date: today, time: 610, title: "Question", body: `Can I move my visit? /${who.firstName}`, read: false, handled: false } }, meta);
    state = applyAction(state, { type: "journal/view", customerId: who.id, actor: "owner" }, meta);
  }
  const journal = state.journals.find((j) => j.customerId === mine.id)!;
  state = applyAction(state, { type: "journal/edit", id: journal.id, content: { treatment: "Corrected treatment", observations: "Fictional observation", advice: "Rest" }, on: today }, meta);
  const review = (id: string, text: string) => ({ id: `r-${id}`, customerId: id, staffId: base.staff[0].id, date: today, rating: 5 as const, text, source: "Booking page" as const });
  state = {
    ...state,
    reviews: [...state.reviews, review(mine.id, "Lovely visit, Lena"), review(theirs.id, "Fine, Olle")],
    sales: [...state.sales, ...[mine.id, theirs.id].map((id) => ({ id: `ps-${id}`, customerId: id, stockId: state.stock[0].id, quantity: 1, amount: 100, date: today }))],
    packages: [...state.packages, ...[mine.id, theirs.id].map((id) => ({ id: `pk-${id}`, customerId: id, serviceId: slot.serviceId, visits: 5, price: 2000, soldOn: today, usedBy: [] }))],
  };
  const hold = (phone: string, name: string) => ({
    id: `hold-${phone}`, expiresAt: 1, serviceId: slot.serviceId, staffId: slot.staffId, date: slot.date, start: slot.start + 120, duration: 30,
    terms, guest: { name, phone, email: "", at: { date: today, time: 600 } }, notice: { kind: "request" as const, date: today, time: 600, title: name, body: "", read: false, handled: false },
  });
  state = { ...state, checkoutHolds: [hold("+46 70 000 11 11", "Lena Exportsson"), hold("0700002222", "Olle Annanperson")] as DemoState["checkoutHolds"] };
  return { state, mine, theirs };
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

describe("customer export", () => {
  it("holds the profile, bookings, journal with versions, messages and consents", () => {
    const { state, mine } = richState();
    const data = customerExport(state, mine.id, "2026-11-16T10:00:00.000Z")!;
    expect(data.format).toBe(EXPORT_FORMAT);
    expect(data.exportedAt).toBe("2026-11-16T10:00:00.000Z");
    expect(data.profile).toEqual(mine);
    expect(data.bookings).toHaveLength(1);
    expect(data.bookings[0]).toMatchObject({ customerId: mine.id, contactEmail: "lena.visit@example.test", note: "Fictional visit note" });
    expect(data.journal).toHaveLength(1);
    expect(data.journal[0].versions).toHaveLength(1);
    expect(data.messages.map((m) => m.title)).toEqual(expect.arrayContaining(["Confirmation for Lena", "Question"]));
    expect(data.consents.waitlistOptIn).toBe(true);
    expect(data.consents.bookingTerms).toEqual([{ bookingId: data.bookings[0].id, version: 1, freeHours: 24, latePercent: 0, noShowPercent: 0, currency: "SEK", priceMinor: 49500, depositMinor: 0 }]);
    expect(data.reviews).toHaveLength(1);
    expect(data.productSales).toHaveLength(1);
    expect(data.packages).toHaveLength(1);
    expect(data.journalAccess).toHaveLength(1);
    expect(data.checkoutHolds).toHaveLength(1);
    expect(data.inTrash).toBe(false);
    expect(customerExport(state, "k-unknown", "2026-11-16T10:00:00.000Z")).toBeNull();
  });

  it("includes everything the erasure removes", () => {
    for (const inTrash of [false, true]) {
      let { state, mine } = richState();
      if (inTrash) state = applyAction(state, { type: "customer/delete", id: mine.id }, meta);
      mine = { ...mine };
      const data = customerExport(state, mine.id, "2026-11-16T10:00:00.000Z")!;
      expect(data.inTrash).toBe(inTrash);
      const erased = eraseCustomer(state, mine.id);
      const exported = Object.values(data).flatMap((value) => (Array.isArray(value) ? value : Object.values(value as object)));

      // Every record the erasure drops from a list of the document, live or in the trash bundle.
      const bundle = state.trash.find((entry) => entry.kind === "customer" && entry.customer.id === mine.id);
      const lists = Object.entries(state).filter(([key, value]) => Array.isArray(value) && !["customers", "log", "trash", "checkoutHolds"].includes(key));
      let checked = 0;
      for (const [key, value] of lists) {
        const theirs = (value as Array<{ customerId?: string }>).filter((item) => item.customerId === mine.id);
        const inBundle = bundle?.kind === "customer" ? ((bundle as unknown as Record<string, Array<{ customerId?: string }>>)[key] ?? []).filter((item) => item.customerId === mine.id) : [];
        for (const record of [...theirs, ...inBundle]) {
          expect(exported.some((item) => sameValue(item, record)), `${key} ${JSON.stringify(record).slice(0, 60)}`).toBe(true);
          checked++;
        }
        const left = ((erased as unknown as Record<string, Array<{ customerId?: string }>>)[key] ?? []).filter((item) => item.customerId === mine.id);
        expect(left, key).toEqual([]);
      }
      // Bookings, journal, two inbox items, review, sale, package and the read of the journal.
      expect(checked).toBeGreaterThanOrEqual(8);

      // Their checkout hold, and the activity entries the erasure rewrites.
      expect(state.checkoutHolds.filter((hold) => !erased.checkoutHolds.includes(hold))).toEqual(
        state.checkoutHolds.filter((hold) => data.checkoutHolds.some((own) => own.id === hold.id) && hold.guest.name === "Lena Exportsson"),
      );
      const rewritten = state.log.filter((entry) => erased.log.find((after) => after.id === entry.id)?.summary !== entry.summary);
      expect(rewritten.length).toBeGreaterThan(0);
      for (const entry of rewritten) {
        const named = data.activity.some((item) => item.id === entry.id);
        const namesOther = JSON.stringify(entry).includes("Olle");
        expect(named || namesOther, entry.summary).toBe(true);
      }
    }
  });

  it("holds nothing about other customers, in JSON or CSV", () => {
    const { state, mine, theirs } = richState();
    const data = customerExport(state, mine.id, "2026-11-16T10:00:00.000Z")!;
    for (const text of [customerExportJson(data), customerExportCsv(data)]) {
      for (const secret of [theirs.firstName, theirs.lastName, theirs.phone, theirs.email, theirs.id, "0700002222", "Treatment for Olle", "Confirmation for Olle", "Fine, Olle", `ps-${theirs.id}`, `pk-${theirs.id}`]) {
        expect(text, secret).not.toContain(secret);
      }
      expect(text).toContain("lena.exportsson@example.test");
    }
    expect(data.other).toEqual({});
    // Another customer's export is likewise free of this one.
    const other = JSON.stringify(customerExport(state, theirs.id, "2026-11-16T10:00:00.000Z"));
    for (const secret of [mine.lastName, mine.phone, mine.email, "lena.visit@example.test", "Treatment for Lena", "Lovely visit"]) expect(other, secret).not.toContain(secret);
  });

  it("writes a flat CSV that carries the same records and defuses formulas", () => {
    const { state, mine } = richState();
    const withFormula: DemoState = { ...state, customers: state.customers.map((c) => (c.id === mine.id ? { ...c, note: "=SUM(A1)" } : c)) };
    const data = customerExport(withFormula, mine.id, "2026-11-16T10:00:00.000Z")!;
    const rows = parseCsv(customerExportCsv(data));
    expect(rows[0]).toEqual(["section", "record_id", "field", "value"]);
    const sections = new Set(rows.slice(1).map((row) => row[0]));
    for (const section of ["export", "profile", "bookings", "journal", "messages", "reviews", "product_sales", "packages", "journal_access", "checkout_holds", "consents"]) expect(sections.has(section), section).toBe(true);
    expect(rows).toContainEqual(["profile", mine.id, "note", "'=SUM(A1)"]);
    expect(rows).toContainEqual(["profile", mine.id, "email", mine.email]);
    expect(rows.some((row) => row[0] === "journal" && row[2] === "versions.0.treatment")).toBe(true);
    expect(customerExportFilename(data, "csv")).toBe(`${state.salon.slug}-customer-${mine.id}-2026-11-16.csv`);
    expect(customerExportFilename(data, "json")).not.toContain("Lena");
  });

  it("shows a deleted customer's data from the trash", () => {
    const { state, mine } = richState();
    const data = customerExport(applyAction(state, { type: "customer/delete", id: mine.id }, meta), mine.id, "2026-11-16T10:00:00.000Z")!;
    expect(data.inTrash).toBe(true);
    expect(data.bookings).toHaveLength(1);
    expect(data.journal).toHaveLength(1);
    expect(data.messages.length).toBeGreaterThanOrEqual(2);
  });
});

describe("customer correction", () => {
  it("covers every personal field of the customer card", () => {
    const { mine } = richState();
    const fields = Object.keys(mine).filter((key) => !["id", "since", "example", "keptOn"].includes(key)).sort();
    expect(Object.keys(CUSTOMER_FIELD_EDITS).sort()).toEqual(fields);
  });

  it("edits every field the card holds, each through an action, and nothing else", () => {
    const { state, mine } = richState();
    const patch: CustomerPatch = { firstName: "Lena-Maria", lastName: "Rättadsson", phone: "070 000 33 33", email: "Lena.Ny@Example.test", birthday: "1991-06-05", tags: [" VIP ", "VIP", "Ny"], waitlist: false, isRegular: true, preferredStaff: base.staff[1].id, category: "both" };
    const next = applyAction(state, { type: "customer/update", id: mine.id, patch }, meta);
    expect(next.customers.find((c) => c.id === mine.id)).toEqual({
      ...mine, firstName: "Lena-Maria", lastName: "Rättadsson", phone: "070 000 33 33", email: "lena.ny@example.test", birthday: "1991-06-05", tags: ["VIP", "Ny"], waitlist: false, isRegular: true, preferredStaff: base.staff[1].id, category: "both",
    });
    expect(next.customers.filter((c) => c.id !== mine.id)).toEqual(state.customers.filter((c) => c.id !== mine.id));
    expect(next.log[0]).toMatchObject({ type: "customer/update", summary: expect.stringContaining("Lena-Maria") });
    // A date of birth and the note can be removed; the note has its own action.
    const cleared = updateCustomer(next, mine.id, { birthday: null });
    expect(cleared.customers.find((c) => c.id === mine.id)).not.toHaveProperty("birthday");
    expect(applyAction(next, { type: "customer/note", id: mine.id, note: "" }, meta).customers.find((c) => c.id === mine.id)?.note).toBeUndefined();
  });

  it("can be undone from the activity log", () => {
    const { state, mine } = richState();
    const next = applyAction(state, { type: "customer/update", id: mine.id, patch: { phone: "070 000 44 44" } }, meta);
    const undone = applyAction(next, { type: "log/undo", id: next.log[0].id }, meta);
    expect(undone.customers.find((c) => c.id === mine.id)?.phone).toBe(mine.phone);
  });

  it("refuses invalid or clashing values and changes nothing", () => {
    const { state, mine, theirs } = richState();
    const problem = (patch: Parameters<typeof correctedCustomer>[2]) => {
      const result = correctedCustomer(state, mine.id, patch);
      return "problem" in result ? result.problem : null;
    };
    expect(problem({ firstName: "  " })).toBe("firstName");
    expect(problem({ phone: "123" })).toBe("phone");
    expect(problem({ phone: "+46 70 000 22 22" })).toBe("phoneTaken");
    expect(problem({ email: "not-an-address" })).toBe("email");
    expect(problem({ email: theirs.email.toUpperCase() })).toBe("emailTaken");
    expect(problem({ birthday: "1990-02-31" })).toBe("birthday");
    expect(problem({ tags: Array.from({ length: 21 }, (_, i) => `t${i}`) })).toBe("tags");
    expect(problem({ preferredStaff: "staff-999" })).toBe("staff");
    expect(problem({ category: "nonsense" })).toBe("category");
    expect(updateCustomer(state, mine.id, { phone: "123" })).toBe(state);
    expect(updateCustomer(state, "k-unknown", { firstName: "Nobody" })).toBe(state);
    // Keeping the same values, or an empty phone and email on a card that allows it, is not a clash with themselves.
    expect(updateCustomer(state, mine.id, { phone: mine.phone, email: mine.email, firstName: mine.firstName })).toBe(state);
    expect(problem({ phone: "", email: "" })).toBeNull();
  });

  it("is redacted like any other personal field when the customer is erased", () => {
    const { state, mine } = richState();
    const corrected = applyAction(state, { type: "customer/update", id: mine.id, patch: { phone: "070 000 55 55", lastName: "Rättadsson" } }, meta);
    expect(corrected.log[0].summary).toContain("Lena Rättadsson");
    const erased = applyAction(corrected, { type: "customer/erase", id: mine.id }, meta);
    const text = JSON.stringify(erased);
    for (const secret of ["070 000 55 55", "0700005555", "Rättadsson", "Corrected the details of"]) expect(text, secret).not.toContain(secret);
    expect(erased.log[0]).toMatchObject({ type: "customer/erase" });
  });
});

describe("visit correction", () => {
  it("corrects the address typed on the booking page and the visit's own texts", () => {
    const { state, mine } = richState();
    const visit = state.bookings.find((b) => b.customerId === mine.id)!;
    const next = applyAction(state, { type: "booking/update", id: visit.id, patch: { contactEmail: " Lena.Ratt@Example.test ", note: " Fictional new note " } }, meta);
    expect(next.bookings.find((b) => b.id === visit.id)).toMatchObject({ contactEmail: "lena.ratt@example.test", note: "Fictional new note" });
    expect(next.log[0]).toMatchObject({ type: "booking/update", summary: expect.stringContaining("Lena") });
    const cleared = updateBooking(next, visit.id, { contactEmail: null, note: null });
    expect(cleared.bookings.find((b) => b.id === visit.id)).not.toHaveProperty("contactEmail");
    expect(cleared.bookings.find((b) => b.id === visit.id)).not.toHaveProperty("note");
    expect(applyAction(next, { type: "log/undo", id: next.log[0].id }, meta).bookings.find((b) => b.id === visit.id)?.contactEmail).toBe("lena.visit@example.test");
  });

  it("changes a cancellation reason only on a cancelled visit and refuses invalid values", () => {
    const { state, mine } = richState();
    const visit = state.bookings.find((b) => b.customerId === mine.id)!;
    expect(updateBooking(state, visit.id, { cancelReason: "Ill" })).toBe(state);
    const cancelled = applyAction(state, { type: "booking/cancel", id: visit.id, reason: "Fictional reason" }, meta);
    expect(updateBooking(cancelled, visit.id, { cancelReason: "Changed my mind" }).bookings.find((b) => b.id === visit.id)?.cancelReason).toBe("Changed my mind");
    expect(updateBooking(state, visit.id, { contactEmail: "not-an-address" })).toBe(state);
    expect(updateBooking(state, visit.id, { note: "x".repeat(501) })).toBe(state);
    expect(updateBooking(state, "b-unknown", { note: "x" })).toBe(state);
    expect(updateBooking(state, visit.id, { contactEmail: "lena.visit@example.test" })).toBe(state);
  });
});
