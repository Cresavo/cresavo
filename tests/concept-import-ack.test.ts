import { afterEach, expect, it, vi } from "vitest";
import { toKey } from "@/concept/data/dates";
import { createSalon, salonDraft } from "@/concept/onboarding/salon";

// An account salon's import counts as saved only when the server accepts it. All people and dates are fictional.

function storage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value); }, removeItem: (key: string) => { items.delete(key); } };
}

const today = toKey(new Date("2026-11-16T12:00:00Z"));
const salon = () => createSalon(today, { ...salonDraft("sv"), name: "Studio Server", industry: "other", treatments: [] });
const staff = () => salon().staff[0].id;
const customers = () => [
  { firstName: "Maja", lastName: "Lind", phone: "073-410 22 18", email: "maja@mail.example", category: "both", preferredStaff: staff(), since: today, isRegular: false, tags: ["Imported"], waitlist: false },
];

async function openAccount(answer: () => Promise<Response>) {
  vi.resetModules();
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage: storage(), sessionStorage: storage(), setTimeout: () => 0 }));
  vi.stubGlobal("document", { cookie: "cresavo_owner=1" });
  const posts: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      posts.push(JSON.parse(String(init.body)));
      return answer();
    }
    return Response.json({ state: salon() });
  }));
  const hint = await import("@/concept/account/hint");
  vi.spyOn(hint, "ownerHintPresent").mockReturnValue(true);
  const sync = await import("@/concept/account/sync");
  const store = await import("@/concept/store");
  const { runCustomerImport } = await import("@/concept/customers/run-import");
  expect(await sync.openSignedInSalon()).toBe(true);
  return { store, posts, run: () => runCustomerImport(store.currentTarget()!, customers(), store.currentState()!.customers.length) };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("waits for the server before the import counts as saved", async () => {
  let accept!: () => void;
  const { store, posts, run } = await openAccount(() => new Promise((resolve) => { accept = () => resolve(Response.json({ state: { ...salon(), customers: [{ id: "k-1" }] }, version: 2 })); }));
  let settled = false;
  const outcome = run().then((result) => { settled = true; return result; });
  await vi.waitFor(() => expect(posts).toHaveLength(1));
  expect(store.currentState()?.customers).toHaveLength(1);
  expect(settled).toBe(false);
  accept();
  expect(await outcome).toMatchObject({ ok: true, added: 1 });
});

it("reports a refusal as failed and brings the salon back to the server's copy", async () => {
  const { store, run } = await openAccount(async () => Response.json({ error: "too_large" }, { status: 413 }));
  expect(await run()).toEqual({ ok: false, reason: "failed" });
  await vi.waitFor(() => expect(store.currentState()?.customers).toHaveLength(0));
});
