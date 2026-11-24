import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { authenticateAgent, createAgentApiKey, type AgentPrincipal } from "../../src/lib/agent-api/keys";
import { createProposal, customerDecision, getProposal } from "../../src/lib/agent-api/proposals";
import { createAgentBooking } from "../../src/lib/agent-api/bookings";
import { contactEmailHash, simulatedEmailCodeSender } from "../../src/lib/agent-api/email-code-consent";
import { POST as consent } from "../../src/app/consent/[id]/decision/route";
import { labRequest, origin } from "../helpers/oauth";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { handleMcp } from "../../src/lib/agent-api/mcp";

// ADR 7: the consent link carries no secret; the customer proves the address with a code.
const clients: string[] = [];
let slot = 0;
const serviceId = `email-code-service-${randomUUID()}`, staffId = `email-code-staff-${randomUUID()}`;
const customer = { name: "Syntetisk Kodkund", email: "kodkund@example.test" };
beforeAll(async () => {
  await db.service.create({ data: { id: serviceId, businessId: "demo", name: "Syntetisk kodbehandling", duration: 30, priceOre: 45000 } });
  const template = await db.staff.findUniqueOrThrow({ where: { id: "staff-erik" } });
  await db.staff.create({ data: { id: staffId, businessId: "demo", name: "Syntetisk Kodpersonal", serviceIds: [serviceId], weekly: template.weekly!, exceptions: [] } });
});
beforeEach(() => {
  vi.stubEnv("BOOKING_CONSENT_LAB", "1"); vi.stubEnv("BOOKING_CONSENT_DELIVERY", "email-code");
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", origin); vi.stubEnv("BOOKING_RUNTIME", "local");
  vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-oauth-socket-proof");
  simulatedEmailCodeSender.clear();
});
afterEach(() => { vi.unstubAllEnvs(); });
afterAll(async () => {
  const keys = await db.agentApiKey.findMany({ where: { clientId: { in: clients } } });
  const links = await db.agentBooking.findMany({ where: { clientId: { in: clients } } });
  await db.agentApiEvent.deleteMany({ where: { keyId: { in: keys.map(k => k.id) } } });
  await db.agentBooking.deleteMany({ where: { clientId: { in: clients } } });
  await db.booking.deleteMany({ where: { id: { in: links.map(l => l.bookingId) } } });
  await db.agentProposal.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentMandate.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentApiKey.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentClient.deleteMany({ where: { id: { in: clients } } });
  await db.staff.deleteMany({ where: { id: staffId } });
  await db.service.deleteMany({ where: { id: serviceId } });
  await db.$disconnect();
});

async function actor() {
  return (await keyed()).principal;
}
async function keyed() {
  const { key } = await createAgentApiKey({ businessId: "demo", agentName: "Email code synthetic test", ownerName: "Synthetic Operator", ownerContact: "code@example.test" }, db);
  const principal = await authenticateAgent(new Headers({ authorization: `Bearer ${key}` }), db, "bookings:write");
  clients.push(principal.clientId);
  return { key, principal };
}
async function mcpClient(key: string, elicitation: boolean) {
  const client = new Client({ name: "synthetic-elicitation-test", version: "1" }, elicitation ? { capabilities: { elicitation: { url: {} } }, versionNegotiation: { mode: "auto" } } : {});
  await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost/api/v1/mcp"), {
    requestInit: { headers: { authorization: `Bearer ${key}` } },
    fetch: async (input, init) => handleMcp(new Request(input, init)),
  }));
  return client;
}
const structured = (result: unknown) => (result as { structuredContent: { proposal: { status: string; mandateId?: string }; consentUrl?: string } }).structuredContent;
function input() {
  let day = DateTime.now().setZone("Europe/Stockholm").startOf("day").plus({ days: 30 + slot++ });
  while (day.weekday > 5) day = day.plus({ days: 1 });
  return { business: "demo", serviceId, serviceVersion: 1, staffId, start: day.set({ hour: 13 }).toISO()! };
}
const decide = (id: string, body: Record<string, unknown>, now?: Date) => customerDecision(id, body, now);
const lastCode = () => simulatedEmailCodeSender.read().at(-1)!;
async function proposed(p: AgentPrincipal) {
  const payload = input();
  const created = await createProposal(p, payload);
  const id = created.proposal.id;
  const seen = await decide(id, { decision: "view" }) as { proposalHash: string };
  return { id, payload, created, proposalHash: seen.proposalHash };
}
const booking = (payload: ReturnType<typeof input>, mandateId: string, who = customer) =>
  ({ ...payload, confirmed: true, mandateId, customer: who });

it("hands the agent a consent link without a secret and no approval", async () => {
  const p = await actor();
  const { id, created } = await proposed(p);
  expect(created).toMatchObject({ approvalRequired: true, approvalDelivery: "customer-email-code", consentUrl: `${origin}/consent/${id}` });
  expect(created).not.toHaveProperty("approvalUrl");
  expect(created.consentUrl).not.toContain("#");
  expect(await db.agentMandate.count({ where: { originReference: id } })).toBe(0);
  const view = await decide(id, { decision: "view" }) as { proposal: { emailCodeRequired: boolean }; customer: null };
  expect(view.proposal.emailCodeRequired).toBe(true);
  expect(view.customer).toBeNull();
  await expect(decide(id, { decision: "view", token: "a".repeat(43) })).rejects.toMatchObject({ code: "mandate_denied" });
});

it("approves only with the code sent to the address, and books only in that address's name", async () => {
  const p = await actor();
  const { id, payload, proposalHash } = await proposed(p);
  await expect(decide(id, { decision: "send-code", email: "real.person@gmail.com" })).rejects.toMatchObject({ code: "synthetic_contact_required" });
  await expect(decide(id, { decision: "yes", proposalHash })).rejects.toMatchObject({ code: "mandate_denied" });
  expect(await decide(id, { decision: "send-code", email: " KodKund@Example.test " })).toEqual({ status: "sent", contactEmailMask: "k***@example.test" });
  const sent = lastCode();
  expect(sent.contactEmailHash).toBe(contactEmailHash(customer.email));
  expect(JSON.stringify(await db.agentProposal.findUniqueOrThrow({ where: { id } }))).not.toContain(customer.email);
  const wrong = sent.code === "000000" ? "000001" : "000000";
  await expect(decide(id, { decision: "yes", proposalHash, code: wrong })).rejects.toMatchObject({ code: "mandate_denied" });
  expect((await db.agentProposal.findUniqueOrThrow({ where: { id } })).otpAttempts).toBe(1);
  expect(await decide(id, { decision: "yes", proposalHash, code: sent.code })).toEqual({ status: "approved" });
  const mandateId = (await getProposal(p, id)).proposal.mandateId!;
  expect((await db.agentMandate.findUniqueOrThrow({ where: { id: mandateId } })).verifiedVia).toBe("email-code-v1");
  await expect(createAgentBooking(p, `other-${id}`, booking(payload, mandateId, { name: customer.name, email: "someone.else@example.test" })))
    .rejects.toMatchObject({ code: "mandate_denied" });
  const created = await createAgentBooking(p, `own-${id}`, booking(payload, mandateId, { name: customer.name, email: "KODKUND@example.test" }));
  expect((created as { body: { booking: { status: string } } }).body.booking.status).toBe("confirmed");
});

it("needs the code to decline too, so the link alone decides nothing", async () => {
  const p = await actor();
  const { id, proposalHash } = await proposed(p);
  await expect(decide(id, { decision: "no", proposalHash })).rejects.toMatchObject({ code: "mandate_denied" });
  expect((await db.agentProposal.findUniqueOrThrow({ where: { id } })).status).toBe("pending");
  await decide(id, { decision: "send-code", email: customer.email });
  expect(await decide(id, { decision: "no", proposalHash, code: lastCode().code })).toEqual({ status: "declined" });
  expect(await db.agentMandate.count({ where: { originReference: id } })).toBe(0);
});

it("waits a minute between codes, stops after five and locks after five wrong codes", async () => {
  const p = await actor();
  const { id, proposalHash } = await proposed(p);
  const start = Date.now();
  await decide(id, { decision: "send-code", email: customer.email }, new Date(start));
  await expect(decide(id, { decision: "send-code", email: customer.email }, new Date(start + 30_000))).rejects.toMatchObject({ code: "rate_limited" });
  for (let i = 1; i < 5; i++) await decide(id, { decision: "send-code", email: customer.email }, new Date(start + i * 61_000));
  await expect(decide(id, { decision: "send-code", email: customer.email }, new Date(start + 5 * 61_000))).rejects.toMatchObject({ code: "rate_limited" });
  const code = lastCode().code, wrong = code === "000000" ? "000001" : "000000";
  for (let i = 0; i < 5; i++) await expect(decide(id, { decision: "yes", proposalHash, code: wrong }, new Date(start + 5 * 61_000))).rejects.toMatchObject({ code: "mandate_denied" });
  await expect(decide(id, { decision: "yes", proposalHash, code }, new Date(start + 5 * 61_000))).rejects.toMatchObject({ code: "mandate_denied" });
  expect(await db.agentMandate.count({ where: { originReference: id } })).toBe(0);
});

it("is reachable only while the email-code profile is on", async () => {
  const p = await actor();
  const { id } = await proposed(p);
  vi.stubEnv("BOOKING_CONSENT_DELIVERY", "legacy-agent-link");
  await expect(decide(id, { decision: "view" })).rejects.toMatchObject({ code: "mandate_denied" });
});

it("serves the decision route without a secret in the link", async () => {
  const p = await actor();
  const { id } = await proposed(p);
  const response = await consent(labRequest(`${origin}/consent/${id}/decision`, { method: "POST",
    headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ decision: "view" }) }), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect((await response.json()).proposal.emailCodeRequired).toBe(true);
});

it("asks a client with URL elicitation to open the consent page, then answers with the outcome", async () => {
  const { key, principal } = await keyed();
  const { id, proposalHash } = await proposed(principal);
  const client = await mcpClient(key, true);
  const asked: string[] = [];
  client.setRequestHandler("elicitation/create", async request => {
    if (request.params.mode !== "url") throw new Error("URL_MODE_EXPECTED");
    asked.push(request.params.url);
    // The person on the salon's page: their own address, the code from their inbox, yes.
    await decide(id, { decision: "send-code", email: customer.email });
    await decide(id, { decision: "yes", proposalHash, code: lastCode().code });
    return { action: "accept" };
  });
  try {
    const answer = structured(await client.callTool({ name: "get_proposal", arguments: { proposalId: id } }));
    expect(asked).toEqual([`${origin}/consent/${id}`]);
    expect(answer.proposal.status).toBe("approved");
    expect(answer.proposal.mandateId).toBeTruthy();
    expect(answer).not.toHaveProperty("consentUrl");
  } finally { await client.close(); }
});

it("gives a client without URL elicitation the ordinary answer with the consent link", async () => {
  const { key, principal } = await keyed();
  const { id } = await proposed(principal);
  const client = await mcpClient(key, false);
  try {
    const answer = structured(await client.callTool({ name: "get_proposal", arguments: { proposalId: id } }));
    expect(answer).toMatchObject({ proposal: { status: "pending" }, consentUrl: `${origin}/consent/${id}` });
  } finally { await client.close(); }
});

it("never treats an accepted elicitation as consent", async () => {
  const { key, principal } = await keyed();
  const { id } = await proposed(principal);
  const client = await mcpClient(key, true);
  client.setRequestHandler("elicitation/create", async () => ({ action: "accept" }));
  try {
    const answer = structured(await client.callTool({ name: "get_proposal", arguments: { proposalId: id } }));
    expect(answer.proposal.status).toBe("pending");
    expect(answer.proposal.mandateId).toBeUndefined();
    expect(await db.agentMandate.count({ where: { originReference: id } })).toBe(0);
  } finally { await client.close(); }
});
