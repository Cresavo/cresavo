import { afterEach, expect, it, vi } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";
import type { DemoState } from "@/concept/data/types";

// A signed-in owner's salon through the commit API: each change resolves with the server's answer for it.
// All people and dates are fictional.

const today = "2026-11-16";
const date = "2026-12-07";
// Building the demo salon is slow, so it is built once and each test gets its own copy.
const base: DemoState = { ...createDemoState(today), industry: "other" };
const salon = (): DemoState => structuredClone(base);

function storage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value); }, removeItem: (key: string) => { items.delete(key); } };
}

type Post = { action: DemoAction; idempotencyKey: string };
type Handler = (post: Post, index: number) => Promise<Response>;

/** Opens the account salon in a fresh store; `server` answers each POST, `read` answers the reload. */
async function openAccount(server: Handler, read: () => Response = () => Response.json({ state: salon() })) {
  vi.resetModules();
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage: storage(), sessionStorage: storage(), setTimeout: () => 0 }));
  vi.stubGlobal("document", { cookie: "" });
  const posts: Post[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method !== "POST") return read();
    const post = JSON.parse(String(init.body)) as Post;
    posts.push(post);
    return server(post, posts.length - 1);
  }));
  const hint = await import("@/concept/account/hint");
  vi.spyOn(hint, "ownerHintPresent").mockReturnValue(true);
  const sync = await import("@/concept/account/sync");
  const store = await import("@/concept/store");
  const commit = await import("@/concept/store/commit");
  const toast = await import("@/concept/studio/log/commit-toast");
  expect(await sync.openSignedInSalon()).toBe(true);
  return { store, posts, commit, toast, target: store.currentTarget()! };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const reply = (state: DemoState, version = 2) => Response.json({ state, version, replayed: false });
const booking = (state: DemoState) => {
  const service = state.services[0];
  const staffId = service.staffIds[0];
  const [start] = freeStarts(state, staffId, date, { serviceId: service.id, duration: service.duration });
  return { type: "booking/create", customerId: state.customers[0].id, serviceId: service.id, staffId, date, start, source: "phone" } as const;
};

it("creates a booking through commitWithUndoToast, which reaches the server and resolves ok", async () => {
  const server = createServer();
  const { toast, target, posts } = await openAccount(async ({ action }) => reply(server.apply(action)));
  const result = await toast.commitWithUndoToast(target, booking(salon()), "Booked");
  expect(result.ok).toBe(true);
  expect(posts.map((p) => p.action.type)).toEqual(["booking/create"]);
  if (result.ok) expect(result.state.bookings.length).toBe(salon().bookings.length + 1);
});

it("gives two overlapping actions of the same type each their own result", async () => {
  const { commit, target, posts } = await openAccount(async ({ action }, index) => {
    const state = { ...salon(), salon: { ...salon().salon, name: `Answer ${index}` } };
    if (action.type === "customer/note") return reply(state, index + 2);
    return Response.json({ error: "rejected" }, { status: 422 });
  });
  const customers = salon().customers;
  const first = commit.commitAction(target, { type: "customer/note", id: customers[0].id, note: "first fictional note" });
  const second = commit.commitAction(target, { type: "customer/note", id: customers[1].id, note: "second fictional note" });
  const [a, b] = await Promise.all([first, second]);
  expect(posts[0].idempotencyKey).not.toBe(posts[1].idempotencyKey);
  expect(a.ok && a.state.salon.name).toBe("Answer 0");
  expect(b.ok && b.state.salon.name).toBe("Answer 1");
});

it("resolves a refusal as failed and puts the server's copy back", async () => {
  const { store, commit, target } = await openAccount(async () => Response.json({ error: "rejected" }, { status: 422 }));
  const result = await commit.commitAction(target, { type: "customer/note", id: salon().customers[0].id, note: "refused fictional note" });
  expect(result).toMatchObject({ ok: false, reason: "rejected" });
  expect(store.currentState()?.customers[0].note).toBe(salon().customers[0].note);
});

it("takes an unsaved change off the screen when the server and the reload are both unreachable", async () => {
  let reads = 0;
  const { store, commit, target } = await openAccount(async () => { throw new Error("offline"); }, () => (reads++ === 0 ? Response.json({ state: salon() }) : new Response(null, { status: 500 })));
  const before = store.currentState()!.customers.length;
  const result = await commit.commitAction(target, { type: "customers/import", customers: [person("073-410 22 18", "maja@mail.example")] });
  expect(result).toMatchObject({ ok: false, reason: "unavailable" });
  expect(store.currentState()?.customers).toHaveLength(before);
});

it("refuses a change made for a salon that is no longer the one shown", async () => {
  const { commit, target, posts } = await openAccount(async () => reply(salon()));
  const result = await commit.commitAction({ ...target, epoch: "another" }, { type: "customer/note", id: salon().customers[0].id, note: "x" });
  expect(result).toMatchObject({ ok: false, reason: "replaced" });
  expect(posts).toHaveLength(0);
});

function person(phone: string, email: string) {
  return { firstName: "Maja", lastName: "Lind", phone, email, category: "both", preferredStaff: salon().staff[0].id, since: today, isRegular: false, tags: ["Imported"], waitlist: false };
}

/** A stand-in for the server: applies each action to its own copy of the salon with the same reducer. */
function createServer() {
  let state = salon();
  return {
    apply(action: DemoAction) {
      const next = reduceOn(state, action);
      return (state = { ...next, log: [{ id: `srv-${next.seq}`, type: action.type, at: 0, summary: "", actor: "owner", source: "button" } as never, ...next.log] });
    },
    add(customer: DemoState["customers"][number]) {
      state = { ...state, customers: [...state.customers, customer] };
    },
    get state() { return state; },
  };
}

import { reduce } from "@/concept/actions";
const reduceOn = (state: DemoState, action: DemoAction) => reduce(state, action);

it("counts an import from the server's state, not another writer's customer, and takes the log id from the server", async () => {
  const server = createServer();
  const { target, store } = await openAccount(async ({ action }) => {
    server.add({ ...salon().customers[0], id: "k-other", phone: "070-999 88 77", email: "other@mail.example" });
    return reply(server.apply(action), 5);
  });
  const { runCustomerImport } = await import("@/concept/customers/run-import");
  const before = store.currentState()!.customers.length;
  const outcome = await runCustomerImport(target, [person("073-410 22 18", "maja@mail.example")]);
  expect(outcome).toMatchObject({ ok: true, added: 1 });
  if (!outcome.ok) return;
  expect(outcome.result.state.customers).toHaveLength(before + 2);
  expect(outcome.result.logId).toBe(server.state.log[0].id);
});

it("reports an import as failed when another salon is on screen before the server answers", async () => {
  let answer!: () => void;
  const server = createServer();
  const { store, target } = await openAccount(() => new Promise((resolve) => { answer = () => resolve(reply(server.apply({ type: "customers/import", customers: [person("073-410 22 18", "maja@mail.example")] }))); }));
  const { runCustomerImport } = await import("@/concept/customers/run-import");
  const outcome = runCustomerImport(target, [person("073-410 22 18", "maja@mail.example")]);
  await vi.waitFor(() => expect(answer).toBeTypeOf("function"));
  store.closeAccountSalon();
  answer();
  expect(await outcome).toEqual({ ok: false, reason: "failed" });
});

it("gives up on a request that never answers, so the waiter and the queue are released", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const { commit, target, posts } = await openAccount(async () => reply(salon()));
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") posts.push(JSON.parse(String(init.body)));
      return new Promise<Response>((resolve, reject) => {
        if (init?.method !== "POST") resolve(Response.json({ state: salon() }));
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }));
    const pending = commit.commitAction(target, { type: "customer/note", id: salon().customers[0].id, note: "slow fictional note" });
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toMatchObject({ ok: false, reason: "unavailable" });
    expect(posts).toHaveLength(2);
  } finally {
    vi.useRealTimers();
  }
});

it("refuses a second change under an idempotency key that is still waiting", async () => {
  let answer!: () => void;
  const { commit, target, posts } = await openAccount(() => new Promise((resolve) => { answer = () => resolve(reply(salon())); }));
  const [customer] = salon().customers;
  const first = commit.commitAction(target, { type: "customer/note", id: customer.id, note: "first fictional note" }, { idempotencyKey: "same-key" });
  await vi.waitFor(() => expect(posts).toHaveLength(1));
  expect(await commit.commitAction(target, { type: "customer/note", id: customer.id, note: "second fictional note" }, { idempotencyKey: "same-key" })).toMatchObject({ ok: false, reason: "conflict" });
  answer();
  expect(await first).toMatchObject({ ok: true });
});

it("counts the import from the reducer's own delta, whatever another writer saved", async () => {
  const server = createServer();
  const { target } = await openAccount(async ({ action }) => {
    server.add({ ...salon().customers[0], id: "k-other", phone: "073-410 22 18", email: "other@mail.example" });
    return reply(server.apply(action), 5);
  });
  const { runCustomerImport } = await import("@/concept/customers/run-import");
  expect(await runCustomerImport(target, [person("073-410 22 18", "maja@mail.example")])).toMatchObject({ ok: true, added: 1 });
});

it("leaves a newer screen alone when an unsaved change cannot be taken back", async () => {
  for (const interrupt of ["another tab saved", "account reopened"] as const) {
    let refuse!: () => void;
    let reads = 0;
    const { store, commit, target } = await openAccount(() => new Promise((resolve) => { refuse = () => resolve(Response.json({ error: "rejected" }, { status: 422 })); }), () => (reads++ === 0 ? Response.json({ state: salon() }) : new Response(null, { status: 500 })));
    const pending = commit.commitAction(target, { type: "customers/import", customers: [person("073-410 22 18", "maja@mail.example")] });
    await vi.waitFor(() => expect(refuse).toBeTypeOf("function"));
    const newer = { ...salon(), customers: [...salon().customers, { ...salon().customers[0], id: "k-newer", phone: "070-111 22 33", email: "" }] };
    if (interrupt === "another tab saved") store.replaceAccountSalon(newer);
    else store.openAccountSalon(newer, () => {});
    refuse();
    expect(await pending).toMatchObject({ ok: false });
    expect(store.currentState()?.customers.some((c) => c.id === "k-newer")).toBe(true);
  }
});
