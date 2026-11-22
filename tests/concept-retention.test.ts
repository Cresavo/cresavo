import { describe, expect, it } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import type { Customer, DemoState } from "@/concept/data/types";
import { applyAction } from "@/concept/log/capture";
import type { LogEntry, LogMeta } from "@/concept/log/types";
import { ageActivityLog } from "@/concept/privacy/activity";
import { JOURNAL_ACCESS_CAP, LOAD_WINDOW_MS, recordJournalView, SAME_READ_WINDOW_MS } from "@/concept/privacy/journal-access";
import { activityCutoff, monthsBefore, OUTBOX_BODY_MS, RATE_LIMIT_MS, RETENTION } from "@/concept/privacy/retention";
import { customersDueForReview, journalsPastRetention } from "@/concept/privacy/review";
import { IDEMPOTENCY_TTL_MS } from "@/concept/store/idempotency";

// Retention rules and the journal access log. Every date is fixed.

const today = "2026-11-16";
const noon = Date.UTC(2026, 10, 16, 12, 0, 0);
const meta: LogMeta = { actor: "owner", source: "button", at: noon };

/** A salon with no bookings and customers whose only trace of a visit is what each test adds. */
function emptySalon(): DemoState {
  return { ...createDemoState(today), customers: [], bookings: [], journals: [], inbox: [], reviews: [], sales: [], packages: [], trash: [], log: [], journalAccess: undefined };
}

function person(id: string, since: string, extra: Partial<Customer> = {}): Customer {
  return { id, firstName: `Fictional${id}`, lastName: "Retention", phone: `07000${id.padStart(5, "0")}`, email: `${id}@example.test`, category: "both", preferredStaff: "anna", since, isRegular: false, tags: [], waitlist: false, ...extra };
}

function withVisit(state: DemoState, customerId: string, date: string, status: "completed" | "booked" = "completed"): DemoState {
  const service = state.services[0];
  return { ...state, bookings: [...state.bookings, { id: `b-${customerId}-${date}`, customerId, staffId: "anna", serviceId: service.id, date, start: 600, duration: 30, price: 500, status, source: "phone" }] };
}

describe("retention config", () => {
  it("holds the agreed defaults in one place", () => {
    expect(RETENTION.inactiveCustomerYears).toBe(3);
    expect(RETENTION.activityPersonalDataMonths).toBe(13);
    expect(RETENTION.outboxBodyDays).toBe(90);
    expect(RETENTION.rateLimitDays).toBe(1);
    expect(RETENTION.idempotencyHours).toBe(24);
    expect(IDEMPOTENCY_TTL_MS).toBe(RETENTION.idempotencyHours * 3_600_000);
    expect(OUTBOX_BODY_MS).toBe(90 * 86_400_000);
    expect(RATE_LIMIT_MS).toBe(86_400_000);
    expect(RETENTION.journalYearsChoices).toContain(5);
  });

  it("counts calendar months back from a fixed instant, clamping the day", () => {
    expect(monthsBefore(Date.UTC(2026, 10, 16, 12), 13)).toBe(Date.UTC(2025, 9, 16, 12));
    expect(monthsBefore(Date.UTC(2026, 2, 31, 8), 1)).toBe(Date.UTC(2026, 1, 28, 8));
    expect(monthsBefore(Date.UTC(2024, 2, 31, 8), 1)).toBe(Date.UTC(2024, 1, 29, 8));
    expect(activityCutoff(noon)).toBe(Date.UTC(2025, 9, 16, 12));
  });
});

describe("customers due for review", () => {
  it("lists customers whose last visit is three years ago or more, oldest first, and never deletes anyone", () => {
    let state: DemoState = { ...emptySalon(), customers: [person("1", "2020-01-01"), person("2", "2020-01-01"), person("3", "2020-01-01"), person("4", "2020-01-01"), person("5", "2023-11-16"), person("6", "2023-11-17")] };
    state = withVisit(state, "1", "2023-11-16");
    state = withVisit(state, "2", "2022-03-01");
    state = withVisit(state, "3", "2024-06-01");
    state = withVisit(state, "4", "2020-05-05");
    state = withVisit(state, "4", "2026-12-24", "booked");
    const rows = customersDueForReview(state, today);
    expect(rows.map((row) => [row.customer.id, row.lastActivity, row.neverVisited])).toEqual([
      ["2", "2022-03-01", false],
      ["1", "2023-11-16", false],
      // Never visited: judged by the day they were added. Three years to the day is due, a day short is not.
      ["5", "2023-11-16", true],
    ]);
    // Customer 4 has a booking ahead, 3 visited recently, 6 is a day short of three years.
    expect(rows.some((row) => ["3", "4", "6"].includes(row.customer.id))).toBe(false);
    expect(state.customers).toHaveLength(6);
  });

  it("leaves a customer off the list for twelve months after the owner kept them, then asks again", () => {
    let state: DemoState = { ...emptySalon(), customers: [person("1", "2019-01-01")] };
    state = withVisit(state, "1", "2020-01-01");
    expect(customersDueForReview(state, today)).toHaveLength(1);
    const kept = applyAction(state, { type: "customer/keep", id: "1", on: "2030-01-01" }, { ...meta, at: Date.UTC(2026, 0, 16, 12) });
    expect(kept.customers[0].keptOn).toBe("2026-01-16");
    expect(customersDueForReview(kept, "2026-11-16")).toEqual([]);
    expect(customersDueForReview(kept, "2027-01-15")).toEqual([]);
    expect(customersDueForReview(kept, "2027-01-16")).toHaveLength(1);
    expect(applyAction(kept, { type: "customer/keep", id: "nobody", on: "2026-11-16" }, meta)).toBe(kept);
  });

  it("works on the demo salon without throwing and lists only live customers", () => {
    const state = createDemoState(today);
    const rows = customersDueForReview(state, today);
    for (const row of rows) expect(state.customers.some((c) => c.id === row.customer.id)).toBe(true);
  });
});

describe("journal retention setting", () => {
  it("is off until the owner picks a period, and then lists customers with older entries", () => {
    let state: DemoState = { ...emptySalon(), customers: [person("1", "2018-01-01"), person("2", "2018-01-01")] };
    const entry = (customerId: string, date: string, n: number) => ({ id: `j-${n}`, customerId, date, staffId: "anna" as const, treatment: "Fictional", observations: "", advice: "" });
    state = { ...state, journals: [entry("1", "2019-05-05", 1), entry("1", "2020-05-05", 2), entry("2", "2026-05-05", 3)] };
    expect(journalsPastRetention(state, today)).toEqual([]);
    const set = applyAction(state, { type: "privacy/journal-retention", years: 5 }, meta);
    expect(set.privacy).toEqual({ journalRetentionYears: 5 });
    expect(journalsPastRetention(set, today).map((row) => [row.customer.id, row.entries, row.oldest])).toEqual([["1", 2, "2019-05-05"]]);
    expect(journalsPastRetention(applyAction(set, { type: "privacy/journal-retention", years: 10 }, meta), today)).toEqual([]);
    // Same value or an arbitrary number changes nothing; null returns to "until I decide".
    expect(applyAction(set, { type: "privacy/journal-retention", years: 5 }, meta)).toBe(set);
    expect(applyAction(set, { type: "privacy/journal-retention", years: 4 }, meta)).toBe(set);
    expect(applyAction(set, { type: "privacy/journal-retention", years: null }, meta).privacy).toEqual({ journalRetentionYears: null });
    expect(set.log[0].summary).toContain("5 years");
  });
});

describe("activity log retention", () => {
  const entry = (id: string, at: number, extra: Partial<LogEntry> = {}): LogEntry => ({ id, type: "customer/note", summary: `Changed the note on Fictional Person ${id}`, actor: "owner", source: "button", at, before: "x", after: "y", patch: { collections: {}, values: {} }, ...extra });

  it("strips text and undo data from entries older than 13 months and keeps the rest", () => {
    const cutoff = activityCutoff(noon);
    const log = [entry("new", noon), entry("edge", cutoff), entry("old", cutoff - 1), entry("older", Date.UTC(2023, 0, 1))];
    const aged = ageActivityLog(log, noon);
    expect(aged[0]).toBe(log[0]);
    expect(aged[1]).toBe(log[1]);
    for (const row of aged.slice(2)) {
      expect(row).toMatchObject({ type: "customer/note", actor: "owner", source: "button", aged: true, summary: "Older entry" });
      expect(row).not.toHaveProperty("patch");
      expect(row).not.toHaveProperty("before");
      expect(JSON.stringify(row)).not.toContain("Fictional Person");
    }
    expect(aged[2].at).toBe(cutoff - 1);
  });

  it("returns the same array when nothing is old enough or already aged", () => {
    const log = [entry("a", noon)];
    expect(ageActivityLog(log, noon)).toBe(log);
    const aged = ageActivityLog([entry("old", 1)], noon);
    expect(ageActivityLog(aged, noon)).toBe(aged);
  });

  it("ages the history before a change runs, so an old undo patch cannot be the first change after the cutoff", () => {
    const before: LogMeta = { actor: "owner", source: "button", at: Date.UTC(2025, 0, 1) };
    const state: DemoState = { ...emptySalon(), customers: [person("1", "2024-01-01")] };
    const noted = applyAction(state, { type: "customer/note", id: "1", note: "Fictional note" }, before);
    const id = noted.log[0].id;
    expect(noted.log[0].patch).toBeDefined();
    // Still inside the period: undo works. Past the cutoff: the patch is gone and the undo is refused.
    expect(applyAction(noted, { type: "log/undo", id }, { ...meta, at: Date.UTC(2026, 0, 1) }).customers[0].note).toBeUndefined();
    expect(applyAction(noted, { type: "log/undo", id }, meta)).toBe(noted);
  });

  it("runs whenever the salon changes, so an old entry does not outlive the next change", () => {
    const state: DemoState = { ...emptySalon(), customers: [person("1", "2025-01-01")], log: [entry("l-old", Date.UTC(2024, 0, 1))] };
    const next = applyAction(state, { type: "customer/note", id: "1", note: "Fictional note" }, meta);
    expect(next.log).toHaveLength(2);
    expect(next.log[1]).toMatchObject({ id: "l-old", aged: true });
    expect(next.log[1]).not.toHaveProperty("patch");
    expect(next.log[0]).not.toHaveProperty("aged");
  });
});

describe("journal access log", () => {
  const withCustomer = (): DemoState => ({ ...emptySalon(), customers: [person("1", "2025-01-01"), person("2", "2025-01-01")] });
  const view = (state: DemoState, at: number, action: Partial<Parameters<typeof recordJournalView>[1]> = {}) => recordJournalView(state, { customerId: "1", actor: "owner", ...action }, at);

  it("records who, when and whose journal, and nothing from the journal", () => {
    const state = view(withCustomer(), noon);
    expect(state.journalAccess).toEqual([{ id: expect.stringMatching(/^ja-/), at: noon, actor: "owner", customerId: "1" }]);
    const staff = view(state, noon + 1000, { customerId: "2", actor: "staff", staffId: "erik" });
    expect(staff.journalAccess![0]).toMatchObject({ actor: "staff", staffId: "erik", customerId: "2", at: noon + 1000 });
    expect(staff.journalAccess).toHaveLength(2);
    expect(Object.keys(staff.journalAccess![0]).sort()).toEqual(["actor", "at", "customerId", "id", "staffId"]);
  });

  it("goes through the reducer without an activity entry and shows no content", () => {
    const state = withCustomer();
    const next = applyAction(state, { type: "journal/view", customerId: "1", actor: "owner" }, meta);
    expect(next.journalAccess).toHaveLength(1);
    expect(next.log).toEqual(state.log);
  });

  it("counts the same reader opening the same journal within a minute once", () => {
    const first = view(withCustomer(), noon);
    expect(view(first, noon + SAME_READ_WINDOW_MS - 1)).toBe(first);
    expect(view(first, noon + SAME_READ_WINDOW_MS).journalAccess).toHaveLength(2);
    expect(view(first, noon + 1, { customerId: "2" }).journalAccess).toHaveLength(2);
    expect(view(first, noon + 1, { actor: "staff", staffId: "erik" }).journalAccess).toHaveLength(2);
  });

  it("logs a load that delivered every journal at most every ten minutes", () => {
    const first = recordJournalView(withCustomer(), { actor: "owner" }, noon);
    expect(first.journalAccess![0]).not.toHaveProperty("customerId");
    expect(recordJournalView(first, { actor: "owner" }, noon + LOAD_WINDOW_MS - 1)).toBe(first);
    expect(recordJournalView(first, { actor: "owner" }, noon + LOAD_WINDOW_MS).journalAccess).toHaveLength(2);
  });

  it("refuses invalid reads", () => {
    const state = withCustomer();
    expect(view(state, noon, { customerId: "k-unknown" })).toBe(state);
    expect(view(state, noon, { actor: "customer" as never })).toBe(state);
    expect(view(state, noon, { actor: "staff", staffId: "staff-999" as never })).toBe(state);
    expect(view(state, noon, { actor: "owner", staffId: "erik" })).toBe(state);
  });

  it("forgets reads older than the log's retention and keeps a cap", () => {
    const old = Date.UTC(2024, 0, 1);
    let state = view(withCustomer(), old);
    state = view(state, noon);
    expect(state.journalAccess).toHaveLength(1);
    expect(state.journalAccess![0].at).toBe(noon);
    const crowded: DemoState = { ...withCustomer(), journalAccess: Array.from({ length: JOURNAL_ACCESS_CAP }, (_, i) => ({ id: `ja-${i}`, at: noon - 1000 - i, actor: "owner" as const, customerId: "2" })) };
    const capped = view(crowded, noon);
    expect(capped.journalAccess).toHaveLength(JOURNAL_ACCESS_CAP);
    expect(capped.journalAccess![0].customerId).toBe("1");
  });

  it("is removed with the customer's other records when they are erased", () => {
    const state = view(view(withCustomer(), noon), noon + 1, { customerId: "2" });
    const erased = applyAction(state, { type: "customer/erase", id: "1" }, meta);
    expect(erased.journalAccess?.map((row) => row.customerId)).toEqual(["2"]);
  });
});
