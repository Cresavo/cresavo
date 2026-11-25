import { describe, expect, it } from "vitest";
import { reduce, type DemoAction } from "@/concept/actions";
import { findCustomerByPhone, isMobilePhone, normalizePhone } from "@/concept/booking/lookup";
import { acceptedTerms } from "@/concept/booking/public-terms";
import { eraseCustomer } from "@/concept/customers/erase";
import { createDemoState } from "@/concept/data/generate";
import { payAtSalon } from "./helpers/pay-at-salon";
import { freeStarts } from "@/concept/data/slots";
import { withTenantPresentation } from "@/concept/i18n/presentation";
import { actionFingerprint } from "@/concept/store/studio-store";

// What a salon's public page may and may not do, decided by the reducer under
// the salon's lock: accepted terms, the page's address, deposits, one phone
// identity, the per-phone cap and the erasure of delivery addresses.
// 2026-11-16 is a Monday. Fictional data only.

const today = "2026-11-16";
const state = payAtSalon(createDemoState(today));
const service = state.services.find((s) => s.id === "medical-foot-care")!;
const guest = { name: "Lisa Berg", phone: "073-555 01 02", email: "lisa.berg@example.test", at: { date: today, time: 600 } };
const startOn = (date: string) => freeStarts(state, "anna", date, { serviceId: service.id, duration: service.duration }, { step: 30 })[0];
const date = "2026-11-24";

type Book = Extract<DemoAction, { type: "online/book" }>;
const publicBook = (over: Partial<typeof guest> = {}, part: Partial<NonNullable<Book["public"]>> = {}, on = date): Book => ({
  type: "online/book", guest: { ...guest, ...over }, serviceId: service.id, staffId: "anna", date: on, start: startOn(on),
  public: { slug: state.salon.slug, terms: acceptedTerms(state, service), publicRef: "ref-fictional-1", ...part },
});

describe("online/book from a salon's public page", () => {
  it("keeps the opaque reference on the visit and writes the owner's notice itself, in the salon's language", () => {
    const sv = { ...state, localization: { ...state.localization, language: "sv" as const } };
    const next = withTenantPresentation(sv, () => reduce(sv, publicBook()));
    expect(next.bookings.at(-1)).toMatchObject({ publicRef: "ref-fictional-1", source: "online" });
    expect(next.inbox.find((item) => item.kind === "request")?.title).toBe("Ny bokning från webben");
    expect(withTenantPresentation(state, () => reduce(state, publicBook())).inbox.find((item) => item.kind === "request")?.title).toBe("New online booking");
  });

  it("books only while the terms the guest accepted still hold", () => {
    const dearer = reduce(state, { type: "service/price", id: service.id, price: service.price + 100 });
    expect(reduce(dearer, publicBook())).toBe(dearer);
    const longer = { ...state, services: state.services.map((s) => (s.id === service.id ? { ...s, duration: s.duration + 15 } : s)) };
    expect(reduce(longer, publicBook())).toBe(longer);
    const stricter = { ...state, cancellationPolicy: { ...state.cancellationPolicy, version: state.cancellationPolicy.version + 1, freeHours: 48 } };
    expect(reduce(stricter, publicBook())).toBe(stricter);
    const euro = { ...state, localization: { ...state.localization, currency: "EUR" } };
    expect(reduce(euro, publicBook())).toBe(euro);
    expect(reduce(state, publicBook()).bookings).toHaveLength(state.bookings.length + 1);
  });

  it("books only for the address the guest was on", () => {
    expect(reduce(state, publicBook({}, { slug: "annan-salong" }))).toBe(state);
  });

  it("treats every guest as new for a deposit, so a known phone number is neither exempt nor told apart", () => {
    const withDeposit = { ...state, cancellationPolicy: { ...state.cancellationPolicy, payAtSalonDefault: false, deposits: { [service.id]: 20000 }, newCustomersOnly: true } };
    const terms = acceptedTerms(withDeposit, service);
    expect(terms.depositMinor).toBeGreaterThan(0);
    for (const phone of [state.customers[0].phone, "073-412 34 56"]) expect(reduce(withDeposit, publicBook({ phone }, { terms }))).toBe(withDeposit);
  });

  it("fingerprints the same intent the same, whatever reference or notice it was sent with", () => {
    const a = publicBook();
    const b = { ...publicBook({}, { publicRef: "ref-fictional-2" }), notice: { title: "Other", body: "Other" } };
    expect(actionFingerprint(a)).toBe(actionFingerprint({ ...b, notice: undefined }));
    expect(actionFingerprint(a)).not.toBe(actionFingerprint(publicBook({ name: "Someone Else" })));
    expect(actionFingerprint(a)).not.toBe(actionFingerprint(publicBook({}, { terms: { ...acceptedTerms(state, service), priceMinor: 1 } })));
  });
});

describe("one identity for a phone number", () => {
  it("is the same in every way an international number is written, and unchanged for Swedish numbers", () => {
    const written = ["+44 (0)7700 900123", "+44 7700 900123", "0044 7700 900123", "+44 07700 900123", "+44(0)7700-900-123"];
    expect(new Set(written.map(normalizePhone)).size).toBe(1);
    expect(written.every(isMobilePhone)).toBe(true);
    expect(["070-174 06 50", "+46 70 174 06 50", "+46 (0)70 174 06 50", "0046701740650"].map(normalizePhone)).toEqual(Array(4).fill("701740650"));
  });

  it("drops a zero only straight after a country code, never inside a national number", () => {
    expect(normalizePhone("073-555 (0)1 02")).toBe(normalizePhone("073-555 01 02"));
    expect(isMobilePhone("073-555 (0)1 02")).toBe(true);
    const customers = [{ ...state.customers[0], phone: "073-555 01 02" }];
    expect(findCustomerByPhone({ customers }, "073-555 (0)1 02")?.id).toBe(customers[0].id);
  });

  it("finds one customer for them, and counts one cap", () => {
    const customers = [{ ...state.customers[0], id: "k-uk", phone: "+44 7700 900123" }, ...state.customers];
    expect(findCustomerByPhone({ customers }, "+44 (0)7700 900123")?.id).toBe(customers[0].id);
    let next = { ...state, customers };
    const days = ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"];
    ["+44 (0)7700 900123", "+44 7700 900123", "0044 7700 900123"].forEach((phone, i) => { next = reduce(next, publicBook({ phone }, {}, days[i])); });
    expect(next.bookings.filter((b) => b.publicRef)).toHaveLength(3);
    expect(reduce(next, publicBook({ phone: "+44 07700 900123" }, {}, days[3]))).toBe(next);
  });
});

describe("the per-phone cap", () => {
  const owner = { ...state.customers[0], phone: "073-555 01 02" };
  const visit = (start: number, i: number) => ({ ...state.bookings[0], id: `b-held-${i}`, customerId: owner.id, source: "online" as const, status: "booked" as const, date: today, start, duration: 60 });

  it("counts only visits that have not ended by the trusted clock", () => {
    const over = { ...state, customers: [owner], bookings: [visit(300, 1), visit(360, 2), visit(420, 3)] };
    expect(reduce(over, publicBook()).bookings).toHaveLength(4);
    const running = { ...over, bookings: [visit(570, 1), visit(660, 2), visit(720, 3)] };
    expect(reduce(running, publicBook())).toBe(running);
  });
});

describe("erasing a customer's address from other visits", () => {
  const owner = { ...state.customers[0], id: "k-owner", email: "owner@example.test" };
  const visit = (id: string, contactEmail: string) => ({ ...state.bookings[0], id, customerId: state.customers[1].id, contactEmail });

  it("clears an address that is exactly theirs, in any case, never one that only contains it, in the salon and in the trash", () => {
    const bundled = { ...state.customers[2], id: "k-bundle" };
    const base = {
      ...state, customers: [owner, ...state.customers.slice(1)],
      bookings: [visit("b-exact", "Owner@Example.test"), visit("b-contains", "not-owner@example.test.se"), visit("b-other", "other@example.test")],
      trash: [{ id: "t-1", kind: "customer", deletedOn: today, customer: bundled, journals: [], reviews: [], inbox: [],
        bookings: [{ ...visit("b-trash", "owner@example.test"), customerId: bundled.id }, { ...visit("b-trash-2", "xowner@example.test"), customerId: bundled.id }] }],
    } as unknown as typeof state;
    const erased = eraseCustomer(base, owner.id);
    expect(erased.bookings.map((b) => b.contactEmail)).toEqual([undefined, "not-owner@example.test.se", "other@example.test"]);
    const bundle = erased.trash.find((e) => e.kind === "customer")!;
    expect(bundle.kind === "customer" && bundle.bookings.map((b) => b.contactEmail)).toEqual([undefined, "xowner@example.test"]);
  });

  it("removes their own visits, and leaves another guest's visit alone even when it holds an address the erased customer typed on theirs", () => {
    const base = { ...state, customers: [owner, ...state.customers.slice(1)], bookings: [{ ...visit("b-own", "someone-else@example.test"), customerId: owner.id }, visit("b-other", "someone-else@example.test")] };
    const erased = eraseCustomer(base, owner.id);
    expect(erased.bookings.map((b) => [b.id, b.contactEmail])).toEqual([["b-other", "someone-else@example.test"]]);
  });
});
