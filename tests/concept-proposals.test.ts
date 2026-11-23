import { describe, expect, it } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { demoOutbox } from "@/concept/connections/demo";
import { addDays } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts, needOf } from "@/concept/data/slots";
import type { DemoState } from "@/concept/data/types";
import { applyAction } from "@/concept/log/capture";
import type { LogMeta } from "@/concept/log/types";
import { MAX_KEPT_PROPOSALS, MAX_PENDING_PROPOSALS, pendingProposals, PROPOSAL_TTL_MS, type NewProposal } from "@/concept/proposals/proposals";
import { bookableServices } from "@/concept/selectors";
import { redactAction } from "@/concept/store/erasure";

// Proposals from assistants as store actions: an assistant proposes, the owner
// decides, and approval applies the change in the same transition. All people
// and salons are fictional.

const today = "2026-11-16";
const now = Date.parse(`${today}T08:00:00Z`);
const ai: LogMeta = { actor: "ai", source: "mcp", at: now };
const owner = (at = now): LogMeta => ({ actor: "owner", source: "button", at });

const base = createDemoState(today);
const service = bookableServices(base).find((s) => s.price > 0)!;
const customer = base.customers[0];

function freeSlot(state: DemoState, offset = 1) {
  for (let i = offset; i <= 21; i++) {
    const date = addDays(today, i);
    for (const staffId of service.staffIds) {
      const start = freeStarts(state, staffId, date, needOf(service))[0];
      if (start !== undefined) return { staffId, date, start };
    }
  }
  throw new Error("No free slot");
}

const slot = freeSlot(base);
const booking: DemoAction = { type: "booking/create", customerId: customer.id, serviceId: service.id, ...slot, source: "assistant" };

const draft = (action: DemoAction = booking, title = `Book ${customer.firstName}`): NewProposal => ({
  title, rows: [{ label: "Time", after: `${slot.date} ${slot.start}` }], action, toast: "Booked", tool: "create_booking", client: "claude",
});

const propose = (state: DemoState, proposal = draft(), meta = ai): DemoState => applyAction(state, { type: "proposal/create", proposal }, meta);
const decide = (state: DemoState, id: string, approve: boolean, meta = owner()): DemoState => applyAction(state, { type: "proposal/decide", id, approve }, meta);
const bookedAt = (state: DemoState) => state.bookings.filter((b) => b.status === "booked" && b.date === slot.date && b.start === slot.start && b.staffId === slot.staffId);

describe("assistant proposals in the store", () => {
  it("stores a pending proposal without applying its change, logged as the assistant", () => {
    const next = propose(base);
    const [proposal] = next.proposals!;
    expect(proposal).toMatchObject({ status: "pending", tool: "create_booking", client: "claude", createdAt: now, expiresAt: now + PROPOSAL_TTL_MS });
    expect(bookedAt(next)).toHaveLength(0);
    expect(next.log[0]).toMatchObject({ type: "proposal/create", actor: "ai", source: "mcp" });
    expect(next.log[0].patch).toBeUndefined();
    expect(pendingProposals(next, now).map((p) => p.id)).toEqual([proposal.id]);
  });

  it("only takes proposals from assistants and decisions from the owner", () => {
    expect(propose(base, draft(), owner())).toBe(base);
    const proposed = propose(base);
    expect(decide(proposed, proposed.proposals![0].id, true, ai)).toBe(proposed);
  });

  it("refuses a change that is not proposable or could not apply now", () => {
    expect(propose(base, draft({ type: "salon/policy", policy: base.cancellationPolicy }))).toBe(base);
    expect(propose(base, draft({ type: "proposal/decide", id: "ap-1", approve: true }))).toBe(base);
    expect(propose(base, draft({ ...booking, serviceId: "no-such-treatment" } as DemoAction))).toBe(base);
    const taken = applyAction(base, booking, owner());
    expect(propose(taken)).toBe(taken);
  });

  it("refuses malformed proposal text", () => {
    expect(propose(base, { ...draft(), title: " " })).toBe(base);
    expect(propose(base, { ...draft(), title: "x".repeat(301) })).toBe(base);
    expect(propose(base, { ...draft(), rows: Array.from({ length: 21 }, () => ({ label: "a", after: "b" })) })).toBe(base);
    expect(propose(base, { ...draft(), tool: "Drop Table" })).toBe(base);
    expect(propose(base, { ...draft(), client: "someone" as NewProposal["client"] })).toBe(base);
  });

  it("applies an approved change in the same transition, once", () => {
    const proposed = propose(base);
    const id = proposed.proposals![0].id;
    const approved = decide(proposed, id, true);
    expect(bookedAt(approved)).toHaveLength(1);
    expect(approved.proposals![0]).toMatchObject({ id, status: "approved", decidedAt: now });
    expect(approved.log[0]).toMatchObject({ type: "proposal/decide", actor: "owner" });
    expect(approved.log).toHaveLength(proposed.log.length + 1);
    expect(decide(approved, id, true)).toBe(approved);
    expect(decide(approved, id, false)).toBe(approved);
  });

  it("records a decline and leaves the salon unchanged", () => {
    const proposed = propose(base);
    const declined = decide(proposed, proposed.proposals![0].id, false);
    expect(declined.proposals![0].status).toBe("declined");
    expect(declined.bookings).toEqual(proposed.bookings);
  });

  it("records a failure when the change no longer applies, and changes nothing else", () => {
    const proposed = propose(base);
    const taken = applyAction(proposed, booking, owner());
    const failed = decide(taken, proposed.proposals![0].id, true);
    expect(failed.proposals![0].status).toBe("failed");
    expect(failed.bookings).toEqual(taken.bookings);
    expect(failed.log[0].summary).toContain("could not be carried out");
  });

  it("expires an undecided proposal, whatever the decision", () => {
    const proposed = propose(base);
    const late = now + PROPOSAL_TTL_MS;
    expect(pendingProposals(proposed, late)).toEqual([]);
    const expired = decide(proposed, proposed.proposals![0].id, true, owner(late));
    expect(expired.proposals![0].status).toBe("expired");
    expect(bookedAt(expired)).toHaveLength(0);
  });

  it("never sends during the check, only once the owner approves", () => {
    const text: DemoAction = { type: "customers/message", texts: [{ customerId: customer.id, title: "Free time", body: "A time opened up." }], at: { date: today, time: 480 } };
    const before = demoOutbox.list("sms").length;
    const proposed = propose(base, draft(text, "Text a customer"));
    expect(proposed.proposals).toHaveLength(1);
    expect(demoOutbox.list("sms")).toHaveLength(before);
    decide(proposed, proposed.proposals![0].id, true);
    expect(demoOutbox.list("sms")).toHaveLength(before + 1);
  });

  it("caps pending proposals and keeps the newest decided ones", () => {
    let state = base;
    const fill = () => {
      for (let i = 0; i < MAX_PENDING_PROPOSALS; i++) state = propose(state);
      for (const proposal of pendingProposals(state, now)) state = decide(state, proposal.id, false);
    };
    for (let i = 0; i < MAX_PENDING_PROPOSALS; i++) state = propose(state);
    expect(propose(state)).toBe(state);
    for (const proposal of pendingProposals(state, now)) state = decide(state, proposal.id, false);
    fill();
    expect(state.proposals).toHaveLength(MAX_KEPT_PROPOSALS);
    const oldest = state.proposals!.at(-1)!.id;
    state = propose(state);
    expect(state.proposals).toHaveLength(MAX_KEPT_PROPOSALS);
    expect(pendingProposals(state, now)).toHaveLength(1);
    expect(state.proposals!.some((p) => p.id === oldest)).toBe(false);
  });

  it("undoes an approval: the change is reverted and the proposal is pending again", () => {
    const proposed = propose(base);
    const id = proposed.proposals![0].id;
    const approved = decide(proposed, id, true);
    const undone = applyAction(approved, { type: "log/undo", id: approved.log[0].id }, owner());
    expect(bookedAt(undone)).toHaveLength(0);
    expect(undone.proposals![0]).toMatchObject({ id, status: "pending" });
    expect(bookedAt(decide(undone, id, true))).toHaveLength(1);
  });

  it("erases proposals that concern an erased customer and keeps the others", () => {
    const other = base.customers[1];
    const theirs = propose(base);
    const both = propose(theirs, draft({ ...booking, customerId: other.id, ...freeSlot(theirs, 2) }, `Book ${other.firstName}`));
    const erased = applyAction(both, { type: "customer/erase", id: customer.id }, owner());
    expect(erased.proposals!.map((p) => p.action)).toEqual([expect.objectContaining({ customerId: other.id })]);
    expect(JSON.stringify(erased.proposals)).not.toContain(customer.id);
  });

  it("redacts a proposal's text and change in the audit log", () => {
    const redacted = redactAction({ type: "proposal/create", proposal: draft() }) as Extract<DemoAction, { type: "proposal/create" }>;
    expect(redacted.proposal).toMatchObject({ title: "[redacted]", rows: "[redacted]", toast: "[redacted]", action: "[redacted]", tool: "create_booking" });
  });

  it("treats a salon saved before proposals as having none", () => {
    const older: DemoState = { ...base };
    delete older.proposals;
    expect(pendingProposals(older, now)).toEqual([]);
    expect(decide(older, "ap-1", true)).toBe(older);
    expect(propose(older).proposals).toHaveLength(1);
  });
});
