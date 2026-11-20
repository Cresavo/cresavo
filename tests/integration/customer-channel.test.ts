import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { createAgentApiKey, authenticateAgent, revokeAgentApiKey } from "../../src/lib/agent-api/keys";
import { createProposal, customerDecision, getProposal } from "../../src/lib/agent-api/proposals";
import { createAgentBooking } from "../../src/lib/agent-api/bookings";
import { CHANNEL_CUSTOMER, CUSTOMER_CHANNEL } from "../../src/lib/agent-api/customer-channel-lab";
import { cleanupRun } from "../../scripts/agentprov/fixtures.mjs";
import { POST as rest } from "../../src/app/api/v1/proposals/route";
import { POST as mcp } from "../../src/app/api/v1/mcp/route";
import { POST as consent } from "../../src/app/consent/[id]/decision/route";
import { labRequest, origin, rpcBody } from "../helpers/oauth";

const serviceId = "channel-" + randomUUID(), staffId = "channel-" + randomUUID();
const root = realpathSync(tmpdir());
let inbox: string, run: string, sequence = 0;
let keys: Awaited<ReturnType<typeof createAgentApiKey>>[] = [];
beforeAll(async () => {
  await db.service.create({ data: { id: serviceId, businessId: "demo", name: "Separat syntetiskt kundprov", duration: 30, priceOre: 45000 } });
  const staff = await db.staff.findUniqueOrThrow({ where: { id: "staff-demo" } });
  await db.staff.create({ data: { id: staffId, businessId: "demo", name: "Syntetisk kanalpersonal", serviceIds: [serviceId], weekly: staff.weekly! } });
});
beforeEach(() => {
  inbox = mkdtempSync(join(root, "booking-consent-inbox-")); chmodSync(inbox, 0o700);
  run = `agentprov-${randomUUID()}`; keys = [];
  vi.stubEnv("BOOKING_CONSENT_LAB", "1"); vi.stubEnv("BOOKING_RUNTIME", "local");
  vi.stubEnv("BOOKING_CONSENT_DELIVERY", "separate-lab"); vi.stubEnv("BOOKING_CONSENT_INBOX_DIR", inbox);
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", origin); vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-oauth-socket-proof");
});
afterEach(async () => {
  try {
    for (const k of keys) await revokeAgentApiKey(k.record.id, db);
    await db.agentProposal.deleteMany({ where: { clientId: { in: keys.map(k => k.record.clientId) } } });
    await cleanupRun(run);
  } finally {
    vi.unstubAllEnvs();
    if (!resolve(inbox).startsWith(root + sep + "booking-consent-inbox-")) throw new Error("OWN_INBOX_REQUIRED");
    rmSync(inbox, { recursive: true });
  }
});
afterAll(async () => { await db.staff.delete({ where: { id: staffId } }); await db.service.delete({ where: { id: serviceId } }); await db.$disconnect(); });
async function actor() {
  const k = await createAgentApiKey({ businessId: "demo", agentName: `${run}-${keys.length}`, ownerName: "Synthetic operator", ownerContact: "operator@example.test" }, db);
  keys.push(k);
  return { ...k, principal: await authenticateAgent(new Headers({ authorization: "Bearer " + k.key }), db, "bookings:write") };
}
function input() {
  let day = DateTime.now().setZone("Europe/Stockholm").startOf("day").plus({ days: 20 + sequence++ });
  while (day.weekday > 5) day = day.plus({ days: 1 });
  return { business: "demo", serviceId, serviceVersion: 1, staffId, start: day.set({ hour: 10 }).toISO()! };
}
function receipt(id: string) {
  const r = JSON.parse(readFileSync(join(inbox, id + ".json"), "utf8"));
  expect(r.customerSubject).toBe(CHANNEL_CUSTOMER.id);
  return new URL(r.approvalUrl).hash.slice(1);
}
async function approve(id: string, token: string) {
  const view = await customerDecision(id, { token, decision: "view" });
  expect(view.customer).toContain(CHANNEL_CUSTOMER.email);
  return customerDecision(id, { token, decision: "yes", proposalHash: view.proposalHash });
}
const payload = (p: ReturnType<typeof input>, mandateId?: string) => ({ ...p, confirmed: true,
  customer: { name: CHANNEL_CUSTOMER.name, email: CHANNEL_CUSTOMER.email }, ...(mandateId ? { mandateId } : {}) });

it.each(["rest", "mcp"])("%s exposes only pending metadata; only the separate customer receipt can approve", async transport => {
  const a = await actor(), args = input();
  const response = transport === "rest"
    ? await rest(new Request(origin + "/api/v1/proposals", { method: "POST", headers: { authorization: "Bearer " + a.key, "content-type": "application/json" }, body: JSON.stringify(args) }))
    : await mcp(new Request(origin + "/api/v1/mcp", { method: "POST", headers: { authorization: "Bearer " + a.key, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_proposal", arguments: args } }) }));
  expect(response.status).toBe(transport === "rest" ? 201 : 200);
  const raw = await response.clone().text();
  const result = transport === "rest" ? await response.json() : (await rpcBody(response)).result.structuredContent;
  expect(result).toMatchObject({ approvalRequired: true, approvalDelivery: "separate-synthetic-customer", proposal: { status: "pending" } });
  const id = result.proposal.id, token = receipt(id);
  for (const value of [token, "approvalUrl", inbox, CHANNEL_CUSTOMER.email])
    expect(raw.includes(value), "agent response must not contain customer delivery material").toBe(false);
  expect(JSON.stringify(await getProposal(a.principal, id)).includes(token), "status must not contain customer credential").toBe(false);
  const url = `${origin}/consent/${id}/decision`;
  for (const body of [{ decision: "yes" }, { token: "x".repeat(43), decision: "view" }, { token, decision: "view" }]) {
    const denied = await consent(labRequest(url, { method: "POST", headers: { origin, "content-type": "application/json", ...(body.token === token ? { authorization: "Bearer " + a.key } : {}) }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
    expect(denied.status).toBe(403);
  }
  await expect(createAgentBooking(a.principal, randomUUID(), payload(args))).rejects.toMatchObject({ code: "mandate_required" });
  await approve(id, token);
  const mandateId = (await getProposal(a.principal, id)).proposal.mandateId!;
  const mandate = await db.agentMandate.findUniqueOrThrow({ where: { id: mandateId } });
  expect(mandate.verifiedVia).toBe(CUSTOMER_CHANNEL);
  const key = randomUUID(), booking = payload(args, mandateId);
  const first = await createAgentBooking(a.principal, key, booking);
  const replay = await createAgentBooking(a.principal, key, booking);
  const links = await db.agentBooking.findMany({ where: { mandateId } });
  expect(links).toHaveLength(1);
  expect("body" in first ? first.body : first).toMatchObject({ booking: { id: links[0].bookingId } });
  expect(replay).toMatchObject({ replayed: true, booking: { id: links[0].bookingId } });
});

it("contact binding survives configuration changes and refuses cross-client authority", async () => {
  const a = await actor(), b = await actor(), args = input();
  const proposal = await createProposal(a.principal, args), id = proposal.proposal.id;
  await approve(id, receipt(id));
  const mandateId = (await getProposal(a.principal, id)).proposal.mandateId!;
  vi.stubEnv("BOOKING_CONSENT_DELIVERY", "legacy-agent-link");
  const booking = payload(args, mandateId);
  for (const customer of [{ ...booking.customer, email: "other@example.test" }, { ...booking.customer, name: "Other Synthetic" }])
    await expect(createAgentBooking(a.principal, randomUUID(), { ...booking, customer })).rejects.toMatchObject({ code: "mandate_denied" });
  await expect(createAgentBooking(b.principal, randomUUID(), booking)).rejects.toMatchObject({ code: "mandate_denied" });
  // The database refuses to unbind a proposal's delivery profile...
  await expect(db.agentProposal.update({ where: { id }, data: { consentDelivery: null } })).rejects.toThrow(/CONSENT_DELIVERY_IMMUTABLE/);
  // ...and the booking path refuses it as well if the guard were bypassed (trigger off for this write only).
  await db.$executeRaw`ALTER TABLE "AgentProposal" DISABLE TRIGGER "AgentProposal_consentDelivery_immutable"`;
  try { await db.agentProposal.update({ where: { id }, data: { consentDelivery: null } }); }
  finally { await db.$executeRaw`ALTER TABLE "AgentProposal" ENABLE TRIGGER "AgentProposal_consentDelivery_immutable"`; }
  await expect(createAgentBooking(a.principal, randomUUID(), booking)).rejects.toMatchObject({ code: "mandate_denied" });
  expect(await db.agentBooking.count({ where: { clientId: a.record.clientId } })).toBe(0);
});

it("concurrent customer decisions create one mandate; unknown DB profiles and recipient JSON are rejected", async () => {
  const a = await actor(), args = input();
  for (const patch of [{ customerPhone: "+46700" + "0".repeat(6) }, { customerSubject: "other" }, { approvalUrl: "https://invalid.example" }])
    await expect(createProposal(a.principal, { ...args, ...patch })).rejects.toBeDefined();
  const p = await createProposal(a.principal, args), id = p.proposal.id, token = receipt(id);
  const view = await customerDecision(id, { token, decision: "view" });
  const outcomes = await Promise.allSettled(Array.from({ length: 20 }, () => customerDecision(id, { token, decision: "yes", proposalHash: view.proposalHash })));
  expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.agentMandate.count({ where: { originReference: id } })).toBe(1);
  await expect(db.$executeRaw`UPDATE "AgentProposal" SET "consentDelivery"='unknown' WHERE "id"=${id}`).rejects.toBeDefined();
  const mandate = await db.agentMandate.findFirstOrThrow({ where: { originReference: id } });
  await expect(db.$executeRaw`UPDATE "AgentMandate" SET "verifiedVia"='unknown' WHERE "id"=${mandate.id}`).rejects.toBeDefined();
  await expect(db.$executeRaw`UPDATE "AgentMandate" SET "origin"='synthetic-operator' WHERE "id"=${mandate.id}`).rejects.toBeDefined();
});

it("missing delivery configuration fails closed, and enabling the channel refuses old pending bearer links", async () => {
  const a = await actor(), args = input();
  vi.stubEnv("BOOKING_CONSENT_INBOX_DIR", "");
  await expect(createProposal(a.principal, args)).rejects.toMatchObject({ code: "mandate_denied" });
  expect(await db.agentProposal.count({ where: { clientId: a.record.clientId } })).toBe(0);
  vi.stubEnv("BOOKING_CONSENT_DELIVERY", "legacy-agent-link");
  const old = await createProposal(a.principal, args), token = new URL(old.approvalUrl!).hash.slice(1);
  vi.stubEnv("BOOKING_CONSENT_DELIVERY", "separate-lab");
  await expect(approve(old.proposal.id, token)).rejects.toMatchObject({ code: "mandate_denied" });
  expect(await db.agentMandate.count({ where: { clientId: a.record.clientId } })).toBe(0);
});
