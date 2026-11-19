import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays } from "../../src/concept/data/dates";
import { assertTestDatabase } from "../../scripts/test-db-guard.mjs";
import { startPairingServer } from "../pairing/server";
import { pairingDb, sweep } from "../../src/concept/pairing/db";
import { base, call, connectRequest, form, jsonPost, moveArgs, resource, sdk, type Booking, type Item, type Proposal, type Tokens } from "../pairing/client";

assertTestDatabase();
const session = (cookie: string, etag = "") => fetch(base + "/api/pairing/session", { headers: { Cookie: cookie, "If-None-Match": etag } });
async function pair() {
  const started = await jsonPost("/api/pairing/session", { action: "start" });
  expect(started.status).toBe(204);
  const cookie = started.headers.get("set-cookie")!.split(";")[0];
  const { id } = await (await session(cookie)).json();
  return { cookie, id: id as string };
}
async function grant(cookie: string, otherCookie?: string, scope?: string) {
  const connection = await connectRequest();
  if (scope) connection.authorization.searchParams.set("scope", scope);
  const foreignResource = new URL(connection.authorization);
  foreignResource.searchParams.set("resource", base + "/api/v1/mcp");
  expect((await fetch(foreignResource, { headers: { Cookie: cookie } })).status).toBe(400);
  const display = await fetch(connection.authorization, { headers: { Cookie: cookie } });
  const html = await display.text();
  const consent = html.match(/name="consent" value="([\w-]+)"/)?.[1];
  if (!consent) throw new Error("Consent page missing");
  const data = { consent, decision: "allow" };
  if (otherCookie) {
    expect((await form("/oauth/authorize", data, otherCookie)).status).toBe(400);
    expect((await form("/oauth/authorize", data, cookie, "https://elsewhere.example.test")).status).toBe(403);
  }
  const accepted = await form("/oauth/authorize", data, cookie);
  expect(accepted.status).toBe(303);
  const url = new URL(accepted.headers.get("location")!);
  expect(url.searchParams.get("state")).toBe(connection.authorization.searchParams.get("state"));
  const code = url.searchParams.get("code")!;
  expect((await connection.redeem(code, { redirect_uri: "https://assistant.example.test/callback/" })).status).toBe(400);
  expect((await connection.redeem(code, { resource: base + "/api/concept/mcp" })).status).toBe(400);
  expect(url.searchParams.get("iss")).toBe(base + "/oauth");
  const issued = await connection.redeem(code);
  expect(issued.status).toBe(200);
  return { clientId: connection.client_id, replay: () => connection.redeem(code), tokens: await issued.json() as Tokens };
}

describe.skipIf(process.env.ASSISTANT_PAIRING !== "1")("paired fictional demo on port 3740", () => {
  let stop: (() => Promise<void>) | undefined;
  beforeAll(async () => { stop = await startPairingServer(); }, 120000);
  afterAll(async () => { await stop?.(); });

  it("isolates both callers throughout discovery, drafts, decisions, refresh, revocation and expiry", async () => {
    expect((await fetch(resource)).status).toBe(401);
    expect(await (await fetch(base + "/.well-known/oauth-protected-resource")).json()).toMatchObject({ resource: base + "/api/v1/mcp" });
    expect(await (await fetch(base + "/.well-known/oauth-authorization-server")).json()).toMatchObject({ token_endpoint: base + "/token" });
    expect(await (await fetch(base + "/.well-known/oauth-protected-resource/mcp/owner")).json()).toMatchObject({ resource, authorization_servers: [base + "/oauth"] });
    expect(await (await fetch(base + "/.well-known/oauth-authorization-server/oauth")).json()).toMatchObject({ registration_endpoint: base + "/oauth/register" });
    expect(await (await fetch(base + "/oauth/authorize")).text()).toContain("Start pairing in the studio");
    const a = await pair(), b = await pair();
    const first = await grant(a.cookie, b.cookie), second = await grant(b.cookie);
    const assistant = await sdk(first.tokens), other = await sdk(second.tokens);
    try {
      const discovered = await assistant.listTools();
      expect(discovered.tools).toHaveLength(23);
      expect(discovered.tools.every(t => t.annotations?.destructiveHint === false)).toBe(true);
      for (const client of [assistant, other]) expect(await call(client, "get_workday_brief")).toMatchObject({ salon: "Salong Eko" });
      const { items } = await call<{ items: Item[] }>(assistant, "list_inbox_items");
      const thread = await call<Item>(assistant, "get_inbox_thread", { itemId: items[0].itemId });
      expect(thread.untrustedCustomerText.body).toBe("Can I move my Friday appointment?");
      expect((await call<Item>(assistant, "get_inbox_thread", { itemId: items[1].itemId })).untrustedCustomerText.body).toMatch(/Ignore/);
      const input = await moveArgs(assistant);
      const initial = await call<Booking>(assistant, "get_booking_details", { bookingId: input.bookingId });
      expect(await call(assistant, "find_bookings", { date: initial.date })).toMatchObject({ bookings: expect.arrayContaining([initial]) });
      const [draft, duplicate] = await Promise.all([
        call<Proposal>(assistant, "propose_reschedule_booking", input),
        call<Proposal>(assistant, "propose_reschedule_booking", input),
      ]);
      expect(duplicate.proposalId).toBe(draft.proposalId);
      expect(draft.status).toBe("pending");
      expect(await call(assistant, "propose_reschedule_booking", input)).toEqual(draft);
      await expect(call(assistant, "propose_reschedule_booking", { ...input, time: "00:00" })).rejects.toThrow("idempotency_conflict");
      expect(await call(assistant, "get_booking_details", { bookingId: input.bookingId })).toEqual(initial);
      const foreign = { bookingId: input.bookingId };
      for (const [name, args] of Object.entries({ get_inbox_thread: { itemId: items[0].itemId }, get_booking_details: foreign,
        find_reschedule_options: foreign, propose_reschedule_booking: input, get_proposal_status: { proposalId: draft.proposalId } })) {
        await expect(call(other, name, args)).rejects.toThrow(/not_found/);
      }
      expect(JSON.stringify(await call(other, "list_inbox_items"))).not.toContain(items[0].itemId);
      expect(JSON.stringify(await call(other, "find_bookings", { date: initial.date }))).not.toContain(initial.bookingId);
      const pending = await session(a.cookie);
      const view = await pending.json();
      expect(await (await session(b.cookie)).json()).toMatchObject({ id: b.id, proposals: [] });
      expect((await session(a.cookie, pending.headers.get("etag")!)).status).toBe(304);
      const command = { workspaceId: a.id, revision: 1, proposalId: draft.proposalId, decision: "approve" };
      expect((await jsonPost("/api/pairing/decision", command, b.cookie)).status).toBe(409);
      expect((await jsonPost("/api/pairing/decision", { ...command, workspaceId: b.id }, b.cookie)).status).toBe(404);
      expect((await jsonPost("/api/pairing/decision", command, a.cookie, "https://elsewhere.example.test")).status).toBe(403);
      expect((await jsonPost("/api/pairing/decision", command)).status).toBe(401);
      for (let retry = 0; retry < 2; retry++) expect(await (await jsonPost("/api/pairing/decision", command, a.cookie)).json()).toMatchObject({ status: "applied" });
      const updated = await (await session(a.cookie, pending.headers.get("etag")!)).json();
      expect(updated.revision).toBe(view.revision + 1);
      expect(await call(assistant, "get_proposal_status", { proposalId: draft.proposalId })).toMatchObject({ status: "applied" });
      expect(await call(assistant, "get_booking_details", foreign)).toMatchObject({ date: input.date, time: input.time });
      const move = { ...input, idempotencyKey: randomUUID(), workspaceId: a.id, revision: updated.revision, date: initial.date, time: initial.time };
      expect((await jsonPost("/api/pairing/move", move, b.cookie)).status).toBe(409);
      const pendingAgain = await call<Proposal>(assistant, "propose_reschedule_booking", moveArgsForRetry(input, initial));
      expect((await jsonPost("/api/pairing/move", { ...move, revision: updated.revision + 1 }, a.cookie)).status).toBe(200);
      expect(await (await jsonPost("/api/pairing/decision", { ...command, revision: updated.revision + 2, proposalId: pendingAgain.proposalId }, a.cookie)).json()).toMatchObject({ status: "conflict" });
      const disconnect = { action: "disconnect", workspaceId: a.id };
      expect((await jsonPost("/api/pairing/session", disconnect, b.cookie)).status).toBe(409);
      const refresh = (token: string) => form("/oauth/token", { client_id: first.clientId, grant_type: "refresh_token", refresh_token: token });
      const renewed = await refresh(first.tokens.refresh_token);
      expect(renewed.status).toBe(200);
      const rotated = await renewed.json() as Tokens;
      expect((await fetch(resource, { headers: { authorization: "Bearer " + first.tokens.access_token } })).status).toBe(401);
      expect((await refresh(first.tokens.refresh_token)).status).toBe(400);
      expect((await refresh(rotated.refresh_token)).status).toBe(400);
      expect((await form("/oauth/revoke", { client_id: second.clientId, token: second.tokens.access_token })).status).toBe(200);
      expect((await fetch(resource, { headers: { authorization: "Bearer " + second.tokens.access_token } })).status).toBe(401);
      const db = pairingDb();
      await db.pairWorkspace.update({ where: { id: b.id }, data: { hardExpiry: new Date(Date.now() - 1000) }, select: { id: true } });
      expect((await session(b.cookie)).status).toBe(401);
      expect((await jsonPost("/api/pairing/session", disconnect, a.cookie)).status).toBe(204);
      expect((await session(a.cookie)).status).toBe(401);
    } finally {
      await Promise.all([assistant.close(), other.close()]);
      await pairingDb().pairWorkspace.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    }
  }, 180000);

  it("reviews a new booking, a price change and a simulated reply in the studio", async () => {
    const { cookie, id } = await pair();
    const { tokens } = await grant(cookie);
    const assistant = await sdk(tokens);
    try {
      const { today } = await call<{ today: string }>(assistant, "get_workday_brief");
      const { treatments } = await call<{ treatments: { serviceId: string; priceMinor: number }[] }>(assistant, "list_treatments");
      const { serviceId, priceMinor } = treatments[0];
      const { slots } = await call<{ slots: { staffId: string; date: string; time: string }[] }>(assistant, "find_bookable_times",
        { serviceId, from: today, to: addDays(today, 7) });
      const slot = slots[0];
      const { customers } = await call<{ customers: { customerId: string }[] }>(assistant, "find_customers", { query: "", limit: 1 });
      const { items } = await call<{ items: Item[] }>(assistant, "list_inbox_items");
      const itemId = items[1].itemId;
      const replyText = "Thank you. We will check the calendar.";
      for (const [name, args] of [
        ["propose_new_booking", { ...slot, serviceId, customerId: customers[0].customerId }],
        ["propose_change_treatment_price", { serviceId, newPrice: priceMinor + 125 }],
        ["propose_reply_to_inbox_item", { itemId, replyText }],
      ] as const) {
        for (const decision of ["decline", "approve"]) {
          const draft = await call<Proposal>(assistant, name, { ...args, idempotencyKey: randomUUID() });
          const studio = await (await session(cookie)).json();
          // The studio view adds the legacy top-level `changes` for already-open tabs and, for replies,
          // the incoming customer message, which only the owner sees.
          expect(studio.proposals).toContainEqual(expect.objectContaining({
            proposalId: draft.proposalId,
            status: draft.status,
            untrustedCustomerText: expect.objectContaining(draft.untrustedCustomerText),
          }));
          expect(draft.status).toBe("pending");
          const result = await jsonPost("/api/pairing/decision", { workspaceId: id, proposalId: draft.proposalId, decision }, cookie);
          expect(result.status).toBe(200);
          const status = decision === "approve" ? "applied" : "declined";
          expect(await call(assistant, "get_proposal_status", { proposalId: draft.proposalId })).toMatchObject({ status });
        }
      }
      const calendar = await call<{ bookings: Booking[] }>(assistant, "find_bookings", { date: slot.date, limit: 50 });
      expect(calendar.bookings).toContainEqual(expect.objectContaining({ ...slot, serviceId, customerId: customers[0].customerId }));
      expect(await call(assistant, "list_treatments")).toMatchObject({ treatments: expect.arrayContaining([expect.objectContaining({ serviceId, priceMinor: priceMinor + 125 })]) });
      expect(await call(assistant, "get_inbox_thread", { itemId })).toMatchObject({ handled: true, untrustedAssistantText: { reply: replyText } });
    } finally {
      await assistant.close();
      await pairingDb().pairWorkspace.deleteMany({ where: { id } });
    }
  }, 90000);

  it("enforces scopes, decline, proposal and request caps, rolling expiry and cleanup", async () => {
    const { cookie, id } = await pair();
    const db = pairingDb();
    try {
      const w = await db.pairWorkspace.findUniqueOrThrow({ where: { id }, select: { ipKey: true } });
      const live = await db.pairWorkspace.count({ where: { ipKey: w.ipKey } });
      const extra = Array.from({ length: Math.max(0, 6 - live) }, () => randomUUID());
      const deadline = new Date(Date.now() + 20 * 60000);
      try {
        await db.pairWorkspace.createMany({ data: extra.map(fixture => ({
          id: fixture, ownerHash: fixture, ipKey: w.ipKey, snapshot: {}, seedDay: "2026-11-18", hardExpiry: deadline, expiresAt: deadline,
        })) });
        expect((await jsonPost("/api/pairing/session", { action: "start" })).status).toBe(429);
      } finally { await db.pairWorkspace.deleteMany({ where: { id: { in: extra } } }); }
      await db.pairWorkspace.update({ where: { id }, data: { expiresAt: new Date(Date.now() + 60000), hardExpiry: deadline }, select: { id: true } });
      const idle = await session(cookie);
      expect(Date.parse((await idle.json()).expiresAt)).toBeLessThan(deadline.getTime());
      expect((await session(cookie, idle.headers.get("ETag")!)).headers.get("x-pair-expiry")).toBe(idle.headers.get("x-pair-expiry"));
      const readGrant = await grant(cookie, undefined, "inbox:read");
      const reader = await sdk(readGrant.tokens);
      expect((await reader.listTools()).tools.map(t => t.name).sort()).toEqual(["get_inbox_thread", "list_inbox_items"]);
      await expect(reader.callTool({ name: "find_bookings", arguments: {} })).rejects.toThrow(/not found/);
      await reader.close();
      const { tokens } = await grant(cookie);
      const grantList = (await (await session(cookie)).json()).grants;
      expect(grantList).toHaveLength(2);
      expect((await readGrant.replay()).status).toBe(400);
      expect((await fetch(resource, { headers: { Authorization: "Bearer " + readGrant.tokens.access_token } })).status).toBe(401);
      expect((await (await session(cookie)).json()).grants).toHaveLength(1);
      const third = await grant(cookie, undefined, "bookings:read");
      const list = (await (await session(cookie)).json()).grants as { id: string; scopes: string }[];
      const target = list.find(g => g.scopes === "bookings:read")!;
      expect((await jsonPost("/api/pairing/session", { action: "revoke", workspaceId: id, grantId: target.id }, cookie)).status).toBe(204);
      expect((await fetch(resource, { headers: { Authorization: "Bearer " + third.tokens.access_token } })).status).toBe(401);
      const client = await sdk(tokens);
      try {
        const args = await moveArgs(client);
        const draft = await call<Proposal>(client, "propose_reschedule_booking", args);
        const view = await (await session(cookie)).json();
        const decision = { workspaceId: id, revision: view.revision, proposalId: draft.proposalId, decision: "decline" };
        expect((await jsonPost("/api/pairing/decision", { ...decision, revision: 1 }, cookie)).status).toBe(200);
        expect(await (await jsonPost("/api/pairing/decision", decision, cookie)).json()).toMatchObject({ status: "declined" });
        await db.pairProposal.createMany({ data: Array.from({ length: 49 }, () => ({
          workspaceId: id, clientId: "fixture", key: randomUUID(), fingerprint: "{}", draft: {}, before: {}, status: "declined",
        })) });
        await expect(call(client, "propose_reschedule_booking", { ...args, idempotencyKey: randomUUID() })).rejects.toThrow("proposal_limit");

        const end = (Math.floor(Date.now() / 60000) + 1) * 60000;
        for (const until of [end, end + 60000]) {
          const key = "mcp:" + id + ":" + until;
          await db.pairBudget.upsert({ where: { key }, create: { key, count: 100, expiresAt: new Date(until) }, update: { count: 100 } });
        }
        expect((await fetch(resource, { headers: { Authorization: "Bearer " + tokens.access_token } })).status).toBe(429);
        await db.pairWorkspace.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) }, select: { id: true } });
        expect((await session(cookie)).status).toBe(401);
        expect((await fetch(resource, { headers: { Authorization: "Bearer " + tokens.access_token } })).status).toBe(401);
        await db.$transaction(tx => sweep(tx));
        expect(await db.pairProposal.count({ where: { workspaceId: id } })).toBe(0);
        expect(await db.pairGrant.count({ where: { workspaceId: id } })).toBe(0);
      } finally { await client.close(); }
    } finally {
      await db.pairWorkspace.deleteMany({ where: { id } });
    }
  }, 90000);
});
function moveArgsForRetry(input: { bookingId: string }, target: Booking) {
  return { bookingId: input.bookingId, date: target.date, time: target.time, idempotencyKey: randomUUID() };
}
