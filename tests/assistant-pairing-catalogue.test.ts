import { randomUUID } from "node:crypto";
import type { PairProposal, PairWorkspace } from "@prisma/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { addDays, formatTime, toMinutes } from "../src/concept/data/dates";
import { pairingDb, type Tx } from "../src/concept/pairing/db";
import { digest } from "../src/concept/pairing/http";
import { freshSnapshot, type PairState } from "../src/concept/pairing/fixture";
import { mcp } from "../src/concept/pairing/mcp";
import { snapshotWorkspace } from "../src/concept/pairing/owner-workspace";
import { SCOPES } from "../src/concept/pairing/policy";

vi.mock("../src/concept/pairing/db", async orig => ({ ...await orig<typeof import("../src/concept/pairing/db")>(), pairingDb: vi.fn() }));
const today = "2026-11-18";
const origin = "https://demo.example";
const all = SCOPES.join(" ");
const token = "a".repeat(43);
const otherToken = "b".repeat(43);
const fixture = () => ({ id: randomUUID(), version: 2, snapshot: freshSnapshot(today) });
type Workspace = ReturnType<typeof fixture>;
function harness() {
  const a = fixture(), b = fixture();
  const workspaces = [a, b];
  const proposals: PairProposal[] = [];
  const deadline = new Date(Date.now() + 3600000);
  const grant = { audience: origin + "/mcp/owner", clientId: "demo", scopes: all, workspaceId: a.id };
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray, key: string) => sql[0].includes("PairBudget") ? [{ count: 1 }] :
      [{ id: key, revision: 1, expiresAt: deadline, hardExpiry: deadline }],
    pairGrantToken: { findFirst: async ({ where }: { where: { accessHash: string } }) =>
      ({ grant: where.accessHash === digest(token) ? grant : { ...grant, workspaceId: b.id } }) },
    pairWorkspace: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => workspaces.find(w => w.id === where.id)!,
      update: async ({ where, data }: { where: { id: string }; data: { snapshot?: PairState } }) => {
        if (data.snapshot) workspaces.find(w => w.id === where.id)!.snapshot = data.snapshot;
      },
    },
    pairProposal: {
      count: async ({ where }: { where: { workspaceId: string } }) => proposals.filter(p => p.workspaceId === where.workspaceId).length,
      create: async ({ data }: { data: PairProposal }) => {
        const row = { ...data, id: randomUUID(), status: "pending" };
        proposals.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { workspaceId_clientId_key: Pick<PairProposal, "workspaceId" | "clientId" | "key"> } }) => {
        const scoped = where.workspaceId_clientId_key;
        return proposals.find(p => p.workspaceId === scoped.workspaceId && p.clientId === scoped.clientId && p.key === scoped.key);
      },
      findFirst: async ({ where }: { where: { workspaceId: string; id: string } }) => proposals.find(p => p.workspaceId === where.workspaceId && p.id === where.id),
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => Object.assign(proposals.find(p => p.id === where.id)!, data),
    },
  };
  vi.mocked(pairingDb).mockReturnValue({ $transaction: (run: (t: typeof tx) => unknown) => run(tx) } as unknown as ReturnType<typeof pairingDb>);
  const workspace = (w: Workspace = a) => snapshotWorkspace(tx as unknown as Tx, w as unknown as PairWorkspace);
  return { a, b, grant, proposals, workspace, tokens: tx.pairGrantToken };
}
async function rpc(method: string, params: unknown, bearer: string) {
  const res = await mcp(new Request(origin + "/mcp/owner", { method: "POST", headers: {
    authorization: "Bearer " + bearer, "content-type": "application/json", accept: "application/json, text/event-stream",
  }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }), origin);
  const body = await res.text();
  const msg = JSON.parse(body.match(/^data: (.+)$/m)?.[1] ?? body);
  if (msg.error) throw new Error(msg.error.message);
  if (msg.result.isError) throw new Error(msg.result.content[0].text);
  return msg.result;
}
async function call(name: string, args = {}, bearer = token) {
  return (await rpc("tools/call", { name, arguments: args }, bearer)).structuredContent;
}

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(today + "T09:00:00Z")); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const areas = {
  "bookings:read": ["get_workday_brief", "list_calendar_window", "find_bookable_times", "find_bookings", "get_booking_details", "find_reschedule_options"],
  "bookings:propose": ["propose_reschedule_booking", "get_proposal_status"],
  "bookings:propose:v2": ["propose_new_booking", "propose_cancel_booking", "propose_reschedule_booking", "propose_block_time", "get_proposal_status"],
  "customers:read": ["find_customers", "get_visit_history", "list_due_back_customers"],
  "inbox:read": ["list_inbox_items", "get_inbox_thread"],
  "inbox:propose": ["propose_reply_to_inbox_item", "get_proposal_status"],
  "catalog:read": ["list_treatments"],
  "catalog:propose": ["propose_change_treatment_price", "propose_change_treatment_availability", "get_proposal_status"],
  "staff:read": ["list_staff", "get_staff_schedule"],
  "finance:read": ["get_finance_summary"],
};
it("discovers and executes only the tools covered by each grant", async () => {
  const { grant } = harness();
  const every = new Set(Object.values(areas).flat());
  for (const [scope, allowed] of Object.entries(areas)) {
    grant.scopes = scope;
    const result = await rpc("tools/list", {}, token);
    expect(result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual([...allowed].sort());
    for (const tool of result.tools) expect(tool.annotations).toMatchObject({ readOnlyHint: !tool.name.startsWith("propose_"), destructiveHint: false });
    for (const name of every) if (!allowed.includes(name)) await expect(call(name)).rejects.toThrow(/not found/i);
  }
});

it("keeps legacy booking grants limited to move proposals and their status", async () => {
  const { a, grant, workspace } = harness();
  const bookingId = a.snapshot.inbox[0].bookingId!;
  const cancel = { bookingId, reason: "customer_request", idempotencyKey: randomUUID() };
  const status = (proposalId: string) => call("get_proposal_status", { proposalId });

  grant.scopes = "bookings:propose";
  await expect(call("propose_cancel_booking", cancel)).rejects.toThrow(/not found/i);
  const move = await call("propose_reschedule_booking", { bookingId, ...workspace().slots(bookingId).slots[0], idempotencyKey: randomUUID() });
  expect(await status(move.proposalId)).toEqual(move);

  grant.scopes = "bookings:propose:v2";
  expect(await status(move.proposalId)).toEqual(move);
  const cancellation = await call("propose_cancel_booking", cancel);
  expect(await status(cancellation.proposalId)).toEqual(cancellation);
  grant.scopes = "bookings:propose";
  await expect(status(cancellation.proposalId)).rejects.toThrow("proposal_not_found");
});

it("rechecks the grant inside the transaction that would create the proposal", async () => {
  const { a, tokens, grant, proposals } = harness();
  const full = { grant };
  vi.spyOn(tokens, "findFirst").mockResolvedValueOnce(full).mockResolvedValueOnce(full).mockResolvedValueOnce(full)
    .mockResolvedValueOnce({ grant: { ...grant, scopes: "inbox:read" } });
  await expect(call("propose_reply_to_inbox_item", { itemId: a.snapshot.inbox[0].id, template: "follow_up", idempotencyKey: randomUUID() }))
    .rejects.toThrow("insufficient_scope");
  expect(proposals).toHaveLength(0);
});

it("returns paged workspace projections, tagged names and limited visit and finance fields", async () => {
  const { a } = harness();
  const { customerId, serviceId, staffId, date } = a.snapshot.bookings.find(b => b.status === "completed")!;
  const ref = a.snapshot.staffRefs![staffId];
  const brief = await call("get_workday_brief");
  expect(brief.today).toBe(today);
  const { entries } = await call("list_calendar_window", { from: date, to: date, staffId: ref });
  expect(entries).toContainEqual(expect.objectContaining({ customerId, staffId: ref, kind: "booking" }));
  const history = await call("get_visit_history", { customerId });
  expect(history.visits).toContainEqual(expect.objectContaining({ customerId, serviceId, status: "completed" }));
  const one = await call("find_customers", { query: "", limit: 1 });
  const two = await call("find_customers", { query: "", limit: 1, offset: one.nextOffset });
  expect(one.customers[0]).not.toEqual(two.customers[0]);
  expect(Object.keys(one.customers[0]).sort()).toEqual(["customerId", "untrustedCustomerText"]);
  expect(one.customers[0].untrustedCustomerText.name).toBeTruthy();
  const due = await call("list_due_back_customers", { limit: 1 });
  expect(due.customers[0]).toMatchObject({ dueDate: expect.any(String), untrustedCustomerText: { name: expect.any(String) } });
  expect((await call("list_treatments")).treatments).toContainEqual(expect.objectContaining({ serviceId, staffIds: [ref], untrustedCustomerText: { name: expect.any(String) } }));
  expect((await call("list_staff")).staff).toContainEqual(expect.objectContaining({ staffId: ref }));
  expect((await call("get_staff_schedule", { staffId: ref, week: today })).days).toHaveLength(7);
  const finance = await call("get_finance_summary", { period: "month" });
  expect(finance.revenueMinor).toBeGreaterThan(0);
  expect(Object.values(finance).every(v => typeof v === "number" || typeof v === "string")).toBe(true);
  const { items } = await call("list_inbox_items");
  expect((await call("get_inbox_thread", { itemId: items[1].itemId })).untrustedCustomerText.body).toMatch(/Ignore/);
  const { bookings } = await call("find_bookings");
  expect(await call("get_booking_details", { bookingId: bookings[0].bookingId })).toEqual(bookings[0]);
  for (const [name, args] of [
    ["get_visit_history", { customerId }], ["find_bookable_times", { serviceId, from: today, to: today }],
    ["get_staff_schedule", { staffId: ref, week: today }], ["list_calendar_window", { staffId: ref, from: today, to: today }],
    ["get_booking_details", { bookingId: bookings[0].bookingId }], ["get_inbox_thread", { itemId: items[0].itemId }],
  ] as const) await expect(call(name, args, otherToken)).rejects.toThrow(/not_found/);
});

it.each(["new_booking", "cancel_booking", "reschedule_booking", "block_time", "reply_to_inbox_item",
  "change_treatment_price", "change_treatment_availability"])("drafts, declines, applies and detects stale %s proposals", async kind => {
  const { a, b, grant, workspace, proposals } = harness();
  const service = a.snapshot.services[0], bookingId = a.snapshot.inbox[0].bookingId!;
  const { slots } = await call("find_bookable_times", { serviceId: service.id, from: today, to: addDays(today, 7) });
  const slot = slots[0];
  const move = (await call("find_reschedule_options", { bookingId })).slots[0];
  const inputs: Record<string, object> = {
    new_booking: { serviceId: service.id, ...slot, newCustomerName: "Robin Vale" },
    cancel_booking: { bookingId, reason: "customer_request" }, reschedule_booking: { bookingId, ...move },
    block_time: { staffId: slot.staffId, date: slot.date, from: slot.time, to: formatTime(toMinutes(slot.time) + 15), reason: "training" },
    reply_to_inbox_item: { itemId: a.snapshot.inbox[1].id, replyText: "Thanks for your message!" },
    change_treatment_price: { serviceId: service.id, newPrice: 55555 },
    change_treatment_availability: { serviceId: service.id, visible: false },
  };
  const name = "propose_" + kind;
  const before = a.snapshot, foreign = b.snapshot;
  const args = { ...inputs[kind], idempotencyKey: randomUUID() };
  const draft = await call(name, args);
  expect(await call(name, args)).toEqual(draft);
  expect(draft.status).toBe("pending");
  expect(draft.untrustedCustomerText.changes.some((r: { before?: string; after: string }) => r.before && r.after)).toBe(true);
  expect(Object.keys(proposals[0].before as { entities: object })).toContain("entities");
  await expect(call(name, args, otherToken)).rejects.toThrow(/not_found/);
  await expect(call("get_proposal_status", { proposalId: draft.proposalId }, otherToken)).rejects.toThrow("proposal_not_found");
  const scope = Object.entries(areas).find(([, names]) => names.includes(name))![0];
  grant.scopes = scope === "catalog:propose" ? "inbox:propose" : "catalog:propose";
  await expect(call("get_proposal_status", { proposalId: draft.proposalId })).rejects.toThrow("proposal_not_found");
  grant.scopes = scope;
  const declined = await call(name, { ...args, idempotencyKey: randomUUID() });
  expect((await workspace().decide(declined.proposalId, false)).status).toBe("declined");
  const stale = await call(name, { ...args, idempotencyKey: randomUUID() });
  expect(a.snapshot).toBe(before);
  expect((await workspace().decide(draft.proposalId, true)).status).toBe("applied");
  expect((await workspace().decide(stale.proposalId, true)).status).toBe("conflict");
  expect((await call("get_proposal_status", { proposalId: draft.proposalId })).status).toBe("applied");
  expect((await workspace().decide(declined.proposalId, true)).status).toBe("declined");
  expect(b.snapshot).toBe(foreign);
  switch (kind) {
    case "new_booking": {
      const made = a.snapshot.bookings.at(-1)!;
      expect(made).toMatchObject({ serviceId: service.id, status: "booked", date: slot.date });
      expect(workspace().booking(made.id).untrustedCustomerText.customer).toBe("Robin Vale");
      break;
    }
    case "reschedule_booking": expect(workspace().booking(bookingId)).toMatchObject(move); break;
    case "cancel_booking": expect(workspace().booking(bookingId).status).toBe("cancelled"); break;
    case "block_time": {
      const calendar = workspace().calendar({ from: slot.date, to: slot.date });
      expect(calendar.entries).toContainEqual(expect.objectContaining({ ...slot, kind: "block" }));
      expect(workspace().bookable({ serviceId: service.id, from: slot.date, to: slot.date }).slots).not.toContainEqual(slot);
      break;
    }
    case "reply_to_inbox_item":
      expect(draft.untrustedCustomerText.changes).toContainEqual(expect.objectContaining({ label: "Written by your assistant", after: "Thanks for your message!" }));
      expect(draft).not.toHaveProperty("changes");
      expect(draft.untrustedCustomerText).not.toHaveProperty("incomingMessage");
      expect(workspace().thread(a.snapshot.inbox[1].id).untrustedAssistantText?.reply).toBe("Thanks for your message!");
      break;
    case "change_treatment_price": expect(a.snapshot.services[0].price).toBe(555.55); break;
    case "change_treatment_availability": {
      expect(draft.untrustedCustomerText.changes).toEqual([{ label: "Paired workspace catalogue", before: "Available to book", after: "Hidden" }]);
      expect((await rpc("tools/list", {}, token)).tools).toContainEqual(expect.objectContaining({
        name, description: "Draft a change to whether a treatment is available to book in the paired workspace.",
      }));
      expect(a.snapshot.services[0].hidden).toBe(true);
      expect(workspace().bookable({ serviceId: service.id, from: slot.date, to: slot.date }).slots).toEqual([]);
      break;
    }
  }
});

it("rejects cancellations at the end of the visit, including drafts awaiting approval", async () => {
  const { a, workspace } = harness();
  const booking = a.snapshot.bookings.find(b => b.date === today && b.status === "booked")!;
  const end = Date.parse(today + "T00:00:00+01:00") + (booking.start + booking.duration) * 60_000;
  const cancellation = () => workspace().propose("client", randomUUID(), {
    kind: "cancel", bookingId: booking.id, reason: "customer_request",
  });
  vi.setSystemTime(end - 60_000);
  const draft = await cancellation();
  vi.setSystemTime(end);
  const earned = workspace().finance("day");
  expect(earned.revenueMinor).toBeGreaterThan(0);
  await expect(cancellation()).rejects.toThrow("booking_unavailable");
  expect((await workspace().decide(draft.proposalId, true)).status).toBe("conflict");
  expect(workspace().history(booking.customerId, {}).visits[0]).toMatchObject({ bookingId: booking.id, status: "booked" });
  expect(workspace().finance("day")).toEqual(earned);
});

it("uses a finished visit still marked booked for the next recall date across Stockholm midnight", () => {
  const { a, workspace } = harness();
  const visit = a.snapshot.bookings.find(b => b.date === today && b.status === "booked")!;
  a.snapshot.services.find(s => s.id === visit.serviceId)!.recallWeeks = 6;
  const oldVisit = { ...visit, id: randomUUID(), date: addDays(today, -49), status: "completed" } as const;
  a.snapshot.bookings = [oldVisit];
  expect(workspace().dueBack({}).customers).toMatchObject([{ customerId: visit.customerId, lastVisit: oldVisit.date }]);
  a.snapshot.bookings.push(visit);

  for (const time of ["2026-11-18T22:59:59Z", "2026-11-18T23:00:00Z"]) {
    vi.setSystemTime(new Date(time));
    expect(workspace().history(visit.customerId, {}).visits[0].bookingId).toBe(visit.id);
    expect(workspace().dueBack({}).customers).toEqual([]);
  }
  const dueDate = addDays(today, 42);
  vi.setSystemTime(new Date(dueDate + "T09:00:00Z"));
  expect(workspace().dueBack({}).customers).toMatchObject([{ customerId: visit.customerId, lastVisit: today, dueDate }]);
});

it("accepts independent blocks but detects a booking slot occupied and freed since drafting", async () => {
  const { a, workspace } = harness();
  const serviceId = a.snapshot.services[0].id;
  const { slots } = workspace().bookable({ serviceId, from: today, to: addDays(today, 7) });
  const slot = slots[0];
  const block = (start: number) => workspace().propose("client", randomUUID(), { kind: "block", staffId: slot.staffId,
    date: slot.date, from: formatTime(start), to: formatTime(start + 15), reason: "break" });
  const start = toMinutes(slot.time);
  const one = await block(start), two = await block(start + 15);
  const book = { kind: "book", serviceId, ...slot, customerId: a.snapshot.customers[0].id } as const;
  const stale = await workspace().propose("client", randomUUID(), book);
  const make = await workspace().propose("client", randomUUID(), book);
  expect((await workspace().decide(make.proposalId, true)).status).toBe("applied");
  const bookingId = a.snapshot.bookings.at(-1)!.id;
  const cancel = await workspace().propose("client", randomUUID(), { kind: "cancel", bookingId, reason: "schedule_change" });
  expect((await workspace().decide(cancel.proposalId, true)).status).toBe("applied");
  for (const draft of [one, two, stale]) expect((await workspace().decide(draft.proposalId, true)).status).toBe("conflict");
  const freshOne = await block(start), freshTwo = await block(start + 15);
  expect((await workspace().decide(freshOne.proposalId, true)).status).toBe("applied");
  expect((await workspace().decide(freshTwo.proposalId, true)).status).toBe("applied");
});

it("binds retries to one intent, validates reply choices and rejects price changes underneath a new booking", async () => {
  const { a, workspace } = harness();
  const service = a.snapshot.services[0];
  const serviceId = service.id, itemId = a.snapshot.inbox[0].id, idempotencyKey = randomUUID();
  const { slots } = workspace().bookable({ serviceId, from: today, to: addDays(today, 7) });
  const booking = { ...slots[0], serviceId, idempotencyKey, newCustomerName: "Sam Linden" };
  await expect(call("propose_new_booking", { ...booking, customerId: a.snapshot.customers[0].id })).rejects.toThrow("choose_customer");
  const pending = await call("propose_new_booking", booking);
  await expect(call("propose_reply_to_inbox_item", { itemId, template: "acknowledge", idempotencyKey })).rejects.toThrow("idempotency_conflict");
  for (const choice of [{}, { template: "follow_up", replyText: "Both" }, { replyText: "x".repeat(321) }]) {
    await expect(call("propose_reply_to_inbox_item", { itemId, ...choice, idempotencyKey: randomUUID() })).rejects.toThrow();
  }
  const reply = await call("propose_reply_to_inbox_item", { itemId, template: "acknowledge", idempotencyKey: randomUUID() });
  expect(reply.untrustedCustomerText.changes[0]).toMatchObject({ label: "Written by your assistant", after: expect.stringContaining("received") });
  for (const price of [service.price + 50, service.price]) {
    const draft = await workspace().propose("client", randomUUID(), { kind: "price", serviceId, newPrice: price * 100 });
    expect((await workspace().decide(draft.proposalId, true)).status).toBe("applied");
  }
  expect((await workspace().decide(pending.proposalId, true)).status).toBe("conflict");
  expect(workspace().customers("Sam Linden", {}).total).toBe(0);
});
