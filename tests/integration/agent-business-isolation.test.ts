import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { db } from "../../src/lib/db";
import { authenticateAgent, createAgentApiKey } from "../../src/lib/agent-api/keys";
import { handleMcp } from "../../src/lib/agent-api/mcp";
import { createProposal } from "../../src/lib/agent-api/proposals";
import { GET as services } from "../../src/app/api/v1/services/route";
import { GET as availability } from "../../src/app/api/v1/availability/route";
import { POST as proposals } from "../../src/app/api/v1/proposals/route";
import { GET as proposal } from "../../src/app/api/v1/proposals/[id]/route";
import { POST as bookings } from "../../src/app/api/v1/bookings/route";
import { GET as booking } from "../../src/app/api/v1/bookings/[id]/route";
import { POST as cancel } from "../../src/app/api/v1/bookings/[id]/cancel/route";
import { cleanupRun, grant } from "../../scripts/agentprov/fixtures.mjs";
import { origin } from "../helpers/lab-request";
import { deleteGrants, grantToken } from "../helpers/agent-grant";
import { POST as salonMcp } from "../../src/app/api/v1/salons/[business]/mcp/route";

// ADR 7 / issue #182: an agent credential for one salon never reads or books at another.
const run = `agentprov-${randomUUID()}`;
type Credential = Awaited<ReturnType<typeof createAgentApiKey>>;
type Slot = { start: string; serviceId: string; durationMinutes: number; staff: { id: string }; locationId: string; scheduleId: string };
let demo: Credential, partner: Credential;
let demoClient: Client, partnerClient: Client;
let demoBookingId: string, demoProposalId: string, slot: Slot;
const clients: Client[] = [];
const oauthClients: string[] = [];

// An API key uses the shared MCP route; a customer agent's OAuth grant uses its salon's own route.
async function connect(key: string, salon?: string) {
  const client = new Client({ name: "synthetic-isolation-test", version: "1" });
  clients.push(client);
  const path = salon ? `/api/v1/salons/${salon}/mcp` : "/api/v1/mcp";
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://localhost${path}`), {
    requestInit: { headers: { authorization: `Bearer ${key}` } },
    fetch: async (input, init) => {
      const request = new Request(input, init);
      if (new URL(request.url).pathname !== path) throw new Error("TEST_TARGET_REFUSED");
      return salon ? salonMcp(request, { params: Promise.resolve({ business: salon }) }) : handleMcp(request);
    },
  }));
  return client;
}
async function tool(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const block = result.content.find(c => c.type === "text");
  if (!block || block.type !== "text") throw new Error("TEST_RESULT_MISSING");
  return JSON.parse(block.text);
}
function rest(key: string, path: string, init: { method?: string; body?: unknown } = {}) {
  const headers = new Headers({ authorization: `Bearer ${key}` });
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.method === "POST") headers.set("idempotency-key", randomUUID());
  return new Request(`http://localhost${path}`, { method: init.method ?? "GET", headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
async function code(response: Response) {
  return { status: response.status, code: (await response.json()).error?.code };
}

const date = () => DateTime.now().setZone("Europe/Stockholm").plus({ days: 3 }).toISODate()!;
const proposalArgs = (business: string) => ({ business, serviceId: slot.serviceId, serviceVersion: 1, staffId: slot.staff.id, start: slot.start });
const bookingArgs = (business: string) => ({ ...proposalArgs(business), confirmed: true, mandateId: "m-" + randomUUID(),
  customer: { name: "Synthetic isolation customer", email: `${run}@example.test` } });

// Every tool the agent MCP registers. Adding a tool without a row here fails the coverage test.
const businessTools: Record<string, (business: string) => Record<string, unknown>> = {
  list_services: business => ({ business }),
  usp_services_list: business => ({ business }),
  usp_services_get: business => ({ business, service: slot.serviceId }),
  get_availability: business => ({ business, service: slot.serviceId, date: date() }),
  usp_availability_query: business => ({ business, service: slot.serviceId, date: date() }),
  create_proposal: business => proposalArgs(business),
  create_booking: business => ({ ...bookingArgs(business), idempotencyKey: randomUUID() }),
  usp_bookings_create: business => ({ ...bookingArgs(business), idempotencyKey: randomUUID() }),
};
const objectTools: Record<string, () => Record<string, unknown>> = {
  get_proposal: () => ({ proposalId: demoProposalId }),
  get_booking: () => ({ bookingId: demoBookingId }),
  usp_bookings_get: () => ({ bookingId: demoBookingId }),
  cancel_booking: () => ({ bookingId: demoBookingId }),
};

beforeAll(async () => {
  vi.stubEnv("BOOKING_CONSENT_LAB", "1"); vi.stubEnv("BOOKING_RUNTIME", "local");
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", origin); vi.stubEnv("AGENT_OAUTH", "1");
  vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-oauth-socket-proof");
  const make = (businessId: string, suffix: string) => createAgentApiKey({ businessId, agentName: `${run}-${suffix}`,
    ownerName: "Synthetic operator", ownerContact: "operator@example.test", kind: "demo-script" }, db);
  demo = await make("demo", "demo"); partner = await make("lab-partner", "partner");
  demoClient = await connect(demo.key); partnerClient = await connect(partner.key);

  for (let d = 3; d < 14 && !slot; d++) {
    const day = DateTime.now().setZone("Europe/Stockholm").plus({ days: d }).toISODate();
    slot = (await tool(demoClient, "get_availability", { business: "demo", service: "massage", date: day })).slots[0];
  }
  if (!slot) throw new Error("TEST_SLOT_MISSING");
  const mandate = await grant(demo.record.clientId, slot, 45000, run);
  const booked = await tool(demoClient, "create_booking", { ...bookingArgs("demo"), mandateId: mandate.id, idempotencyKey: randomUUID() });
  demoBookingId = booked.booking.id;
  const principal = await authenticateAgent(new Headers({ authorization: `Bearer ${demo.key}` }), db, "bookings:write");
  demoProposalId = (await createProposal(principal, proposalArgs("demo"))).proposal.id;
}, 30000);

afterAll(async () => {
  for (const client of clients) await client.close();
  await db.agentProposal.deleteMany({ where: { clientId: { in: [demo.record.clientId, partner.record.clientId] } } });
  await cleanupRun(run);
  await db.agentClient.deleteMany({ where: { id: { in: await deleteGrants(oauthClients) } } });
  vi.unstubAllEnvs();
  await db.$disconnect();
});

describe("agent credentials stay inside their own salon", () => {
  it("covers every registered MCP tool", async () => {
    const { tools } = await demoClient.listTools();
    expect(tools.map(t => t.name).sort()).toEqual([...Object.keys(businessTools), ...Object.keys(objectTools)].sort());
  });

  it("refuses another salon's business id in every MCP tool, both directions", async () => {
    for (const [name, args] of Object.entries(businessTools)) {
      expect((await tool(demoClient, name, args("lab-partner"))).error?.code, `demo → lab-partner via ${name}`).toBe("forbidden_business");
      expect((await tool(partnerClient, name, args("demo"))).error?.code, `lab-partner → demo via ${name}`).toBe("forbidden_business");
    }
  }, 30000);

  it("hides another salon's proposals and bookings in every MCP tool", async () => {
    for (const [name, args] of Object.entries(objectTools))
      expect((await tool(partnerClient, name, args())).error?.code, `lab-partner reads demo via ${name}`).toBe("booking_not_found");
  }, 30000);

  it("refuses another salon over every REST v1 route", async () => {
    const q = (business: string) => `business=${business}&service=${slot.serviceId}&date=${date()}`;
    for (const [key, other] of [[demo.key, "lab-partner"], [partner.key, "demo"]] as const) {
      expect(await code(await services(rest(key, `/api/v1/services?business=${other}`)))).toEqual({ status: 403, code: "forbidden_business" });
      expect(await code(await availability(rest(key, `/api/v1/availability?${q(other)}`)))).toEqual({ status: 403, code: "forbidden_business" });
      expect(await code(await proposals(rest(key, "/api/v1/proposals", { method: "POST", body: proposalArgs(other) }))))
        .toEqual({ status: 403, code: "forbidden_business" });
      expect(await code(await bookings(rest(key, "/api/v1/bookings", { method: "POST", body: bookingArgs(other) }))))
        .toEqual({ status: 403, code: "forbidden_business" });
    }
    const notFound = { status: 404, code: "booking_not_found" };
    expect(await code(await proposal(rest(partner.key, `/api/v1/proposals/${demoProposalId}`), params(demoProposalId)))).toEqual(notFound);
    expect(await code(await booking(rest(partner.key, `/api/v1/bookings/${demoBookingId}`), params(demoBookingId)))).toEqual(notFound);
    expect(await code(await cancel(rest(partner.key, `/api/v1/bookings/${demoBookingId}/cancel`, { method: "POST" }), params(demoBookingId))))
      .toEqual(notFound);
  }, 30000);

  it("holds for a customer agent's OAuth grant for another salon", async () => {
    const grant = await grantToken("lab-partner", ["services:read", "availability:read", "bookings:read", "bookings:write"]);
    oauthClients.push(grant.oauthClientId);
    const client = await connect(grant.accessToken, "lab-partner");
    for (const [name, args] of Object.entries(businessTools))
      expect((await tool(client, name, args("demo"))).error?.code, `OAuth lab-partner → demo via ${name}`).toBe("forbidden_business");
    for (const [name, args] of Object.entries(objectTools))
      expect((await tool(client, name, args())).error?.code, `OAuth lab-partner reads demo via ${name}`).toBe("booking_not_found");
  }, 30000);

  it("leaves the demo booking untouched and gives the other salon nothing", async () => {
    expect((await tool(demoClient, "get_booking", { bookingId: demoBookingId })).booking.status).toBe("confirmed");
    const other = { clientId: partner.record.clientId };
    expect(await db.agentBooking.count({ where: other })).toBe(0);
    expect(await db.agentProposal.count({ where: other })).toBe(0);
    expect(await db.agentMandate.count({ where: other })).toBe(0);
  });
});
