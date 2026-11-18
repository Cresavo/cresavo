import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { createDemoState } from "@/concept/data/generate";
import { applyAction } from "@/concept/log/capture";
import { isUndoable } from "@/concept/log/undo";
import { activeGrant, grantStatus } from "@/concept/support/access";
import { buildTicket, TICKET_ACTIVITY } from "@/concept/support/tickets";

const base = createDemoState("2026-11-16");
const meta = { actor: "owner", source: "button", at: 1_000 } as const;
const HOUR = 3_600_000;

describe("support access", () => {
  it("grants read access for the chosen time and ends it", () => {
    const granted = reduce(base, { type: "support/grant", hours: 1, at: 1_000 });
    expect(activeGrant(granted, 1_000 + HOUR - 1)).toMatchObject({ grantedAt: 1_000, until: 1_000 + HOUR });
    expect(activeGrant(granted, 1_000 + HOUR)).toBeUndefined();
    expect(grantStatus(granted.supportGrants[0], 1_000 + HOUR)).toBe("expired");
    const day = reduce(base, { type: "support/grant", hours: 24, at: 0 });
    expect(day.supportGrants[0].until).toBe(24 * HOUR);
  });

  it("allows one grant at a time and revokes it", () => {
    const granted = reduce(base, { type: "support/grant", hours: 24, at: 0 });
    expect(reduce(granted, { type: "support/grant", hours: 1, at: 10 })).toBe(granted);
    const revoked = reduce(granted, { type: "support/revoke", at: 500 });
    expect(activeGrant(revoked, 501)).toBeUndefined();
    expect(grantStatus(revoked.supportGrants[0], 501)).toBe("revoked");
    expect(reduce(revoked, { type: "support/revoke", at: 600 })).toBe(revoked);
  });

  it("logs every grant and revoke and keeps them out of Undo", () => {
    const granted = applyAction(base, { type: "support/grant", hours: 1, at: 1_000 }, meta);
    const revoked = applyAction(granted, { type: "support/revoke", at: 2_000 }, { ...meta, at: 2_000 });
    expect(revoked.log.map((e) => e.summary)).toEqual(["Stopped support access", "Gave support read access for 1 h"]);
    expect(revoked.log.every((e) => !isUndoable(revoked, e))).toBe(true);
    expect(revoked.supportGrants).toHaveLength(1);
  });
});

describe("tickets", () => {
  it("saves a ticket with the last 20 changes, newest first", () => {
    let state = base;
    for (let i = 0; i < TICKET_ACTIVITY + 3; i++) state = applyAction(state, { type: "service/price", id: "classic-60", price: 100 + i }, meta);
    const ticket = buildTicket({ question: "  Help  ", path: "/studio", requestId: "req-12345678", screen: ["Heading: Today"] }, state.log, 5);
    expect(ticket).toMatchObject({ question: "Help", createdAt: 5 });
    expect(ticket.activity).toHaveLength(TICKET_ACTIVITY);
    expect(ticket.activity[0].summary).toBe(state.log[0].summary);
    expect(Object.keys(ticket.activity[0]).sort()).toEqual(["actor", "at", "summary"]);
    const withTicket = applyAction(state, { type: "ticket/create", ticket }, meta);
    expect(withTicket.tickets).toHaveLength(1);
    expect(withTicket.tickets[0].id).toMatch(/^tk-/);
    expect(withTicket.log[0].summary).toBe("Created a support ticket");
  });
});
