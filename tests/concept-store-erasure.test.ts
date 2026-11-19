import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { addDays, toKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import type { Customer, DemoState } from "@/concept/data/types";
import { applyAction } from "@/concept/log/capture";
import { TRASH_DAYS } from "@/concept/trash/trash";

// The browser store erases a customer whose 30 days in the trash are over when
// it loads the saved salon, and writes that back. Fictional data only.

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

const NAME = "Fictional Expired";
const KEY = "salong-eko-demo";

/** Today's demo salon with a customer deleted 30 days ago (still in the trash and in the log's undo data). */
function savedWithExpiredCustomer(): string {
  const today = toKey(new Date());
  const base = createDemoState(today);
  const customer: Customer = {
    id: "k-expired", firstName: "Fictional", lastName: "Expired", phone: "0700005678", email: "", category: base.customers[0].category,
    preferredStaff: base.staff[0].id, since: today, isRegular: false, tags: [], waitlist: false,
  };
  const withCustomer: DemoState = { ...base, customers: [...base.customers, customer] };
  const deleted = applyAction({ ...withCustomer, generatedFor: addDays(today, -TRASH_DAYS) }, { type: "customer/delete", id: customer.id }, { actor: "owner", source: "button", at: 0 });
  return JSON.stringify({ ...deleted, generatedFor: today });
}

it("writes the erasure of an expired trash entry back to storage", async () => {
  let raw = savedWithExpiredCustomer();
  expect(raw).toContain(NAME);
  const localStorage = {
    getItem: vi.fn((key: string) => (key === KEY ? raw : null)),
    setItem: vi.fn((key: string, value: string) => { if (key === KEY) raw = value; }),
  };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage }));
  const { currentState } = await import("@/concept/store");
  expect(JSON.stringify(currentState())).not.toContain(NAME);
  expect(localStorage.setItem.mock.calls.filter(([key]) => key === KEY)).toHaveLength(1);
  expect(raw).not.toContain(NAME);
  // Reading again finds nothing more to do.
  currentState();
  expect(localStorage.setItem.mock.calls.filter(([key]) => key === KEY)).toHaveLength(1);
});

it("does not overwrite another tab's newer write with the erasure", async () => {
  const raw = savedWithExpiredCustomer();
  const newer = JSON.stringify({ ...JSON.parse(raw), seq: JSON.parse(raw).seq + 5 });
  // Another tab saves between this tab's read and its write-back check.
  const localStorage = {
    getItem: vi.fn((key: string) => (key !== KEY ? null : new Error().stack?.includes("persistErasure") ? newer : raw)),
    setItem: vi.fn(),
  };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage }));
  const { currentState } = await import("@/concept/store");
  expect(JSON.stringify(currentState())).not.toContain(NAME);
  expect(localStorage.setItem.mock.calls.filter(([key]) => key === KEY)).toEqual([]);
});
