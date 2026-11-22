import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { runTask } from "@/concept/ai/run-task";
import { buildImportRows, decodeImportFile, guessMapping, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseBirthday, parseCsv, readImportFile, summarizeImport } from "@/concept/customers/csv";
import { editJournalEntry } from "@/concept/customers/journal";
import { bookingLink, dueBackList, intervalWeeks, nextVisitFor, suggestionSent, suggestSlot } from "@/concept/customers/return-visits";
import { birthdayThisMonth, newThisYear, notSeenInThreeMonths, regulars, segmentCustomers, SEGMENTS } from "@/concept/customers/segments";
import { buildCustomerFacts, summarizeFallback, type CustomerFacts } from "@/concept/customers/summary";
import { addDays } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import type { Booking, Customer, DemoState } from "@/concept/data/types";
import { buildCustomerStats } from "@/concept/selectors";

const today = "2026-11-17";
const base = createDemoState(today);
const stats = buildCustomerStats(base, today);

const facts: CustomerFacts = { sinceYear: 2024, regular: true, visits: 12, service: "Foot care", intervalWeeks: 6, traits: ["sensitive skin"], prefersStaff: "Anna", timeOfDay: "afternoons", note: null };

/** A state with one customer and a hand-made visit history. */
function scenario(visits: Partial<Booking>[], customer: Partial<Customer> = {}): { state: DemoState; customer: Customer } {
  const cust: Customer = { id: "t1", firstName: "Test", lastName: "Person", phone: "070-111 11 11", email: "", category: "foot", preferredStaff: "anna", since: "2024-02-01", isRegular: true, tags: [], waitlist: false, ...customer };
  const bookings = visits.map((v, i): Booking => ({ id: `tb${i}`, customerId: "t1", staffId: "anna", serviceId: "basic-foot-care", date: today, start: 14 * 60, duration: 45, price: 650, status: "completed", source: "phone", ...v }));
  return { state: { ...base, customers: [cust], bookings, journals: [], inbox: [] }, customer: cust };
}

describe("customer summary", () => {
  it("phrases the facts as one line, the way the owner would say it", () => {
    expect(summarizeFallback(facts)).toBe("Regular since 2024, foot care every 6 weeks, sensitive skin, prefers Anna, afternoons.");
  });
  it("leaves out what is not known", () => {
    expect(summarizeFallback({ ...facts, regular: false, service: null, intervalWeeks: null, traits: [], prefersStaff: null, timeOfDay: null, visits: 0 })).toBe("Customer since 2024, no visits yet.");
    expect(summarizeFallback({ ...facts, prefersStaff: null, traits: [] })).toBe("Regular since 2024, foot care every 6 weeks, prefers afternoons.");
  });
  it("derives habits from finished visits only", () => {
    const visits = [0, 42, 84, 126].map((offset) => ({ date: addDays("2026-05-04", offset) }));
    const { state, customer } = scenario([...visits, { date: "2026-10-01", status: "cancelled" }], { tags: ["Regular", "Sensitive skin"] });
    expect(buildCustomerFacts(state, customer)).toMatchObject({ sinceYear: 2024, visits: 4, service: "Basic foot care", intervalWeeks: 6, traits: ["sensitive skin"], prefersStaff: "Anna", timeOfDay: "afternoons" });
  });
  it("uses the recommended interval and no habits before three visits", () => {
    const { state, customer } = scenario([{ date: "2026-10-01" }]);
    expect(buildCustomerFacts(state, customer)).toMatchObject({ intervalWeeks: 6, prefersStaff: null, timeOfDay: null });
  });
  it("runs through the summarize-customer task without a key", async () => {
    const { output, log } = await runTask("summarize-customer", facts, { env: {} });
    expect(output.summary).toBe(summarizeFallback(facts));
    expect(log.source).toBe("rules");
  });
});

describe("segments", () => {
  it("regulars are the customers marked as regulars", () => {
    expect(regulars(base)).toHaveLength(40);
  });
  it("not seen in 3 months: visited before, nothing booked, last visit over 91 days ago", () => {
    const { state } = scenario([{ date: addDays(today, -92) }]);
    const other = { ...state.customers[0], id: "t2", phone: "070-222 22 22" };
    const withRecent: DemoState = { ...state, customers: [...state.customers, other], bookings: [...state.bookings, { ...state.bookings[0], id: "x", customerId: "t2", date: addDays(today, -91) }] };
    expect(notSeenInThreeMonths(withRecent, buildCustomerStats(withRecent, today), today).map((c) => c.id)).toEqual(["t1"]);
    const booked: DemoState = { ...state, bookings: [...state.bookings, { ...state.bookings[0], id: "y", date: addDays(today, 3), status: "booked" }] };
    expect(notSeenInThreeMonths(booked, buildCustomerStats(booked, today), today)).toEqual([]);
  });
  it("new this year and birthday this month use the calendar", () => {
    expect(newThisYear(base, today).every((c) => c.since.startsWith("2026"))).toBe(true);
    const birthdays = birthdayThisMonth(base, today);
    expect(birthdays.length).toBeGreaterThan(5);
    expect(birthdays.every((c) => c.birthday?.slice(5, 7) === "11")).toBe(true);
    expect(birthdayThisMonth(base, "2027-02-10").every((c) => c.birthday?.slice(5, 7) === "02")).toBe(true);
  });
  it("lists every segment for the marketing studio", () => {
    expect(SEGMENTS.map((s) => s.id)).toEqual(["regulars", "notSeen", "newThisYear", "birthdayThisMonth"]);
    for (const segment of SEGMENTS) expect(segmentCustomers(segment.id, base, stats, today)).toEqual(segment.select(base, stats, today));
  });
});

describe("return-visit engine", () => {
  it("is due when the service interval has passed with nothing booked", () => {
    const due = scenario([{ date: addDays(today, -6 * 7 - 3) }]);
    const row = dueBackList(due.state, buildCustomerStats(due.state, today), today)[0];
    expect(row).toMatchObject({ dueDate: addDays(today, -3), overdueDays: 3, sent: false });
    expect(row.customer.id).toBe("t1");
  });
  it("is not due before the interval, when booked, or when gone for over three months", () => {
    const early = scenario([{ date: addDays(today, -6 * 7 + 1) }]);
    expect(dueBackList(early.state, buildCustomerStats(early.state, today), today)).toEqual([]);
    const booked = scenario([{ date: addDays(today, -60) }, { date: addDays(today, 5), status: "booked" }]);
    expect(dueBackList(booked.state, buildCustomerStats(booked.state, today), today)).toEqual([]);
    const gone = scenario([{ date: addDays(today, -100) }]);
    expect(dueBackList(gone.state, buildCustomerStats(gone.state, today), today)).toEqual([]);
  });
  it("follows the interval set per service", () => {
    const { state } = scenario([{ date: addDays(today, -4 * 7) }]);
    expect(dueBackList(state, buildCustomerStats(state, today), today)).toEqual([]);
    const shorter = reduce(state, { type: "service/recall", id: "basic-foot-care", weeks: 3 });
    expect(dueBackList(shorter, buildCustomerStats(shorter, today), today)[0].overdueDays).toBe(7);
  });
  it("clamps the interval to a sensible range", () => {
    expect(reduce(base, { type: "service/recall", id: "classic-60", weeks: 0 }).services.find((s) => s.id === "classic-60")!.recallWeeks).toBe(1);
    expect(reduce(base, { type: "service/recall", id: "classic-60", weeks: 99 }).services.find((s) => s.id === "classic-60")!.recallWeeks).toBe(26);
  });
  it("lets a journal note override the interval", () => {
    const { state, customer } = scenario([{ date: "2026-10-01" }]);
    const service = state.services.find((s) => s.id === "basic-foot-care")!;
    const withNote: DemoState = { ...state, journals: [{ id: "j", customerId: "t1", date: "2026-10-01", staffId: "anna", treatment: "x", observations: "", advice: "", nextVisit: "In 3 weeks" }] };
    expect(intervalWeeks(state, customer, service, "2026-10-01")).toBe(6);
    expect(intervalWeeks(withNote, customer, service, "2026-10-01")).toBe(3);
    expect(nextVisitFor(withNote, customer, buildCustomerStats(withNote, today))).toMatchObject({ date: "2026-10-22", weeks: 3 });
  });
  it("knows a time suggestion was sent after the last visit", () => {
    const { state } = scenario([{ date: addDays(today, -50) }]);
    const sent = reduce(state, { type: "inbox/add", item: { kind: "system", customerId: "t1", recallServiceId: "basic-foot-care", date: today, time: 600, title: "x", body: "y", read: false, handled: true } });
    expect(suggestionSent(state, "t1", addDays(today, -50))).toBe(false);
    expect(suggestionSent(sent, "t1", addDays(today, -50))).toBe(true);
    expect(dueBackList(sent, buildCustomerStats(sent, today), today)[0].sent).toBe(true);
  });
  it("proposes a free time with the preferred person, near the usual time, with a ready booking link", () => {
    const { state, customer } = scenario([{ date: addDays(today, -50), start: 9 * 60 }]);
    const service = state.services.find((s) => s.id === "basic-foot-care")!;
    const slot = suggestSlot(state, customer, service, today)!;
    expect(slot).toMatchObject({ staffId: "anna", serviceId: "basic-foot-care" });
    expect(slot.date > today).toBe(true);
    expect(slot.start).toBeLessThanOrEqual(10 * 60);
    expect(bookingLink(state, "basic-foot-care")).toBe("/boka/salong-eko?service=basic-foot-care");
  });
  it("finds due-back customers in the demo data", () => {
    expect(dueBackList(base, stats, today).length).toBeGreaterThan(3);
  });
});

describe("CSV import", () => {
  const csv = 'First name;Last name;Mobile;E-mail;Birthday;Note\r\nMaja;Lind;073-410 22 18;maja@mail.example;1986-11-21;"Likes mornings; no lavender"\r\n\r\nOskar;"Berg ""OB"" ström";073-410 31 07;;09/03/1979;';
  it("parses quoted cells, doubled quotes, blank lines, CRLF and the delimiter", () => {
    const rows = parseCsv(`﻿${csv}`);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(["First name", "Last name", "Mobile", "E-mail", "Birthday", "Note"]);
    expect(rows[1][5]).toBe("Likes mornings; no lavender");
    expect(rows[2][1]).toBe('Berg "OB" ström');
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("guesses the mapping from header names", () => {
    expect(guessMapping(["Förnamn", "Efternamn", "Telefon", "E-post", "Födelsedag", "Anteckning"])).toMatchObject({ firstName: 0, lastName: 1, phone: 2, birthday: 4 });
    expect(guessMapping(["Name", "Phone", "Email"])).toEqual({ fullName: 0, phone: 1, email: 2 });
  });
  it("reads birthdays day first and refuses impossible dates", () => {
    expect(parseBirthday("1986-11-21")).toBe("1986-11-21");
    expect(parseBirthday("09/03/1979")).toBe("1979-03-09");
    expect(parseBirthday("9.3.1979")).toBe("1979-03-09");
    expect(parseBirthday("31/02/1990")).toBeUndefined();
    expect(parseBirthday("not known")).toBeUndefined();
  });
  const defaults = { since: today, preferredStaff: "anna" } as const;
  it("builds customers and flags missing names, short phones and duplicates", () => {
    const rows = [
      ["Maja Lind", "073-410 22 18", "1986-11-21"],
      ["", "073-410 31 07", ""],
      ["Sigrid Forsberg", "", ""],
      ["Maja Again", "+46 73 410 22 18", ""],
      ["Known Person", base.customers[0].phone, ""],
      ["Viktor Holm", "073-410 71 40", "someday"],
    ];
    const result = buildImportRows(rows, { fullName: 0, phone: 1, birthday: 2 }, base.customers, defaults);
    expect(result.map((r) => r.problem)).toEqual([undefined, "missingName", "missingPhone", "duplicate", "duplicate", undefined]);
    expect(result[0].customer).toMatchObject({ firstName: "Maja", lastName: "Lind", birthday: "1986-11-21", tags: ["Imported"], since: today });
    expect(result[5]).toMatchObject({ birthdayIgnored: true });
    expect(result[1].line).toBe(3);
  });
  it("imports through the store action and never adds the same phone twice", () => {
    const rows = buildImportRows([["Maja", "Lind", "073-410 22 18"], ["Oskar", "Berg", "073-410 31 07"]], { firstName: 0, lastName: 1, phone: 2 }, base.customers, defaults);
    const customers = rows.flatMap((r) => (r.customer ? [r.customer] : []));
    const next = reduce(base, { type: "customers/import", customers });
    expect(next.customers).toHaveLength(base.customers.length + 2);
    expect(new Set(next.customers.map((c) => c.id)).size).toBe(next.customers.length);
    expect(reduce(next, { type: "customers/import", customers })).toBe(next);
  });
  it("parses quotes, semicolons, tabs, a BOM, CRLF, blank lines and ragged rows", () => {
    expect(parseCsv('﻿Name;Note\r\n"Lind; Maja";"said ""hi""\nthen left"\r\n\r\nOskar\r\n')).toEqual([["Name", "Note"], ["Lind; Maja", 'said "hi"\nthen left'], ["Oskar"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv('"a,b";c\n1;2')).toEqual([["a,b", "c"], ["1", "2"]]);
    expect(parseCsv("")).toEqual([]);
  });
  it("maps Swedish and English headers, and never a national ID column", () => {
    expect(guessMapping(["Förnamn", "Efternamn", "Telefonnummer", "E-post", "Födelsedag", "Anteckning", "Personnummer"])).toEqual({ firstName: 0, lastName: 1, phone: 2, email: 3, birthday: 4, note: 5 });
    expect(guessMapping(["Kundnamn", "Mobil", "Email", "Comments"])).toEqual({ fullName: 0, phone: 1, email: 2, note: 3 });
  });
  it("flags invalid and overlong values and ragged rows without throwing", () => {
    const mapping = { fullName: 0, phone: 1, email: 2 };
    const rows = buildImportRows([["Maja Lind", "073-410 22 18", "not-an-email"], ["Oskar", "073-410 31 07"], ["X".repeat(121), "073-410 45 63", ""]], mapping, [], defaults);
    expect(rows.map((r) => r.problem)).toEqual(["badEmail", undefined, "tooLong"]);
    expect(rows[1].customer?.email).toBe("");
  });
  it("treats the same e-mail, in the file or already a customer, as a duplicate", () => {
    const known = { phone: "070-111 11 11", email: "Known@mail.example" };
    const rows = buildImportRows([["A", "073-410 22 18", "known@mail.example"], ["B", "073-410 31 07", "b@mail.example"], ["C", "073-410 45 63", "B@mail.example"]], { firstName: 0, phone: 1, email: 2 }, [known], defaults);
    expect(rows.map((r) => r.problem)).toEqual(["duplicate", undefined, "duplicate"]);
    expect(summarizeImport(rows)).toEqual({ ready: 1, duplicates: 2, errors: 0 });
  });
  it("imports without consent and drops repeated e-mails in the reducer", () => {
    const [row] = buildImportRows([["Maja", "073-410 22 18", "maja@mail.example"]], { firstName: 0, phone: 1, email: 2 }, [], defaults);
    expect(row.customer?.waitlist).toBe(false);
    const sameEmail = { ...row.customer!, phone: "073-410 31 07" };
    const next = reduce(base, { type: "customers/import", customers: [row.customer!, sameEmail] });
    expect(next.customers).toHaveLength(base.customers.length + 1);
  });
  it("limits file size and row count", () => {
    expect(readImportFile("name\n" + "a".repeat(MAX_IMPORT_BYTES))).toEqual({ problem: "tooBig" });
    expect(readImportFile("name\n" + "a\n".repeat(MAX_IMPORT_ROWS + 1))).toEqual({ problem: "tooMany" });
    expect(readImportFile("name\n" + "a\n".repeat(MAX_IMPORT_ROWS))).toHaveProperty("rows");
    expect(readImportFile("name")).toEqual({ problem: "empty" });
  });
  it("accepts the example file's columns", async () => {
    const [header, ...body] = parseCsv(await readFile("public/demo/customers-example.csv", "utf8"));
    const rows = buildImportRows(body, guessMapping(header), base.customers, defaults);
    expect(rows).toHaveLength(12);
    expect(rows.filter((r) => r.customer)).toHaveLength(10);
    expect(rows.filter((r) => r.problem).map((r) => r.problem).sort()).toEqual(["duplicate", "missingPhone"]);
  });
});

describe("journal versions", () => {
  const entry = { id: "j1", customerId: "t1", date: "2026-11-01", staffId: "anna" as const, treatment: "Foot care", observations: "Dry heels", advice: "Cream", nextVisit: "In 6 weeks" };
  it("keeps the previous content when an entry is edited", () => {
    const edited = editJournalEntry(entry, { treatment: "Foot care", observations: "Dry heels, left toe red", advice: "Cream", nextVisit: "In 6 weeks" }, "2026-11-05");
    expect(edited.observations).toBe("Dry heels, left toe red");
    expect(edited.versions).toEqual([{ treatment: "Foot care", observations: "Dry heels", advice: "Cream", nextVisit: "In 6 weeks", photos: undefined, replacedOn: "2026-11-05" }]);
    const again = editJournalEntry(edited, { ...edited, advice: "Cream and rest" }, "2026-11-09");
    expect(again.versions?.map((v) => v.advice)).toEqual(["Cream", "Cream"]);
    expect(again.versions?.map((v) => v.observations)).toEqual(["Dry heels", "Dry heels, left toe red"]);
  });
  it("does nothing when nothing changed, and treats a blank next visit as none", () => {
    expect(editJournalEntry(entry, entry, "2026-11-05")).toBe(entry);
    expect(editJournalEntry(entry, { ...entry, nextVisit: "  " }, "2026-11-05").nextVisit).toBeUndefined();
  });
  it("versions photo changes too", () => {
    const edited = editJournalEntry(entry, { ...entry, photos: { before: "/demo/massage.webp" } }, "2026-11-05");
    expect(edited.photos).toEqual({ before: "/demo/massage.webp" });
    expect(edited.versions).toHaveLength(1);
  });
  it("edits through the store action and leaves other entries alone", () => {
    const state: DemoState = { ...base, journals: [entry, { ...entry, id: "j2" }] };
    const next = reduce(state, { type: "journal/edit", id: "j1", content: { ...entry, advice: "More cream" }, on: "2026-11-05" });
    expect(next.journals[0]).toMatchObject({ advice: "More cream", versions: [{ advice: "Cream" }] });
    expect(next.journals[1]).toBe(state.journals[1]);
    expect(reduce(state, { type: "journal/edit", id: "j1", content: entry, on: "2026-11-05" }).journals[0]).toBe(entry);
  });
});

describe("decodeImportFile", () => {
  it("reads UTF-8 with a BOM and falls back to Windows-1252 for older exports", () => {
    const utf8 = new TextEncoder().encode("\uFEFFnamn\nÅsa Öberg").buffer as ArrayBuffer;
    expect(decodeImportFile(utf8)).toContain("Åsa Öberg");
    const latin = new Uint8Array([0x6e, 0x61, 0x6d, 0x6e, 0x0a, 0xc5, 0x73, 0x61, 0x20, 0xd6, 0x62, 0x65, 0x72, 0x67]).buffer;
    expect(decodeImportFile(latin)).toBe("namn\nÅsa Öberg");
  });
});
