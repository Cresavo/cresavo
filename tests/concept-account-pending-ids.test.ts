import { afterEach, expect, it, vi } from "vitest";
import { reduce, type DemoAction } from "@/concept/actions";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";
import type { DemoState } from "@/concept/data/types";

// Issue #138: two writers on one account salon allocate the same provisional ids. While a change is
// pending, Undo and move must not act on the record that change made, because the server may give
// that id to the other writer's record. All people and dates are fictional.

const today = "2026-11-16";
const date = "2026-12-07";
const opened: DemoState = { ...createDemoState(today), industry: "other" };

function storage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value); }, removeItem: (key: string) => { items.delete(key); } };
}

/** What the server does for a change: the reducer, and a log entry named after the counter as the store names its own. */
function serverApply(state: DemoState, action: DemoAction): DemoState {
  const next = reduce(state, action, 0);
  return { ...next, log: [{ id: `l-${next.seq}`, type: action.type, at: 0, summary: "", actor: "owner", source: "button" } as never, ...next.log] };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("keeps Undo and move off provisional records until the server's answer, then names the intended ones", async () => {
  vi.resetModules();
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage: storage(), sessionStorage: storage(), setTimeout: () => 0 }));
  vi.stubGlobal("document", { cookie: "" });

  const service = opened.services[0];
  const staffId = service.staffIds[0];
  const starts = freeStarts(opened, staffId, date, { serviceId: service.id, duration: service.duration });
  const first = starts[0];
  const second = starts.find((start) => start >= first + service.duration + 60)!;
  const make = (start: number, source: "phone" | "online"): DemoAction => ({ type: "booking/create", customerId: opened.customers[0].id, serviceId: service.id, staffId, date, start, source });

  // Writer B saved a booking after this tab (writer A) opened the salon; the server holds it.
  const afterB = serverApply(structuredClone(opened), make(first, "phone"));
  let release!: (response: Response) => void;
  const answered = new Promise<Response>((resolve) => { release = resolve; });
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => init?.method === "POST" ? answered : Response.json({ state: opened })));
  const hint = await import("@/concept/account/hint");
  vi.spyOn(hint, "ownerHintPresent").mockReturnValue(true);
  const sync = await import("@/concept/account/sync");
  const store = await import("@/concept/store");
  const commit = await import("@/concept/store/commit");
  expect(await sync.openSignedInSalon()).toBe(true);
  const known = store.currentState()!.bookings[0];

  // Writer A books too; locally it takes the very ids B's booking and log entry hold on the server.
  const pending = commit.commitAction(store.currentTarget()!, make(second, "online"));
  const local = store.currentState()!;
  const provisional = local.bookings.find((b) => !opened.bookings.some((o) => o.id === b.id))!;
  const logId = local.log[0].id;
  expect(afterB.bookings.find((b) => b.id === provisional.id)?.source).toBe("phone");
  expect(afterB.log.some((l) => l.id === logId)).toBe(true);

  expect(store.accountRecordSettled("bookings", provisional.id)).toBe(false);
  expect(store.accountRecordSettled("log", logId)).toBe(false);
  expect(store.accountRecordSettled("bookings", known.id)).toBe(true);

  const afterA = serverApply(afterB, make(second, "online"));
  release(Response.json({ state: afterA, version: 3, replayed: false }));
  const result = await pending;
  expect(result.ok).toBe(true);

  // The server's copy is shown: every id is the server's, and A's own records have their own ids.
  const shown = store.currentState()!;
  expect(store.accountRecordSettled("bookings", provisional.id)).toBe(true);
  expect(shown.bookings.find((b) => b.id === provisional.id)?.source).toBe("phone");
  expect(shown.bookings.filter((b) => b.start === second && b.date === date && b.staffId === staffId)).toHaveLength(1);
  if (result.ok) expect(shown.log.find((l) => l.id === result.logId)).toBeDefined();
});
