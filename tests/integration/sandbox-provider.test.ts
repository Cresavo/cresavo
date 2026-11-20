import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type IncomingMessage } from "node:http";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { DateTime } from "luxon";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { sandboxAgentRoute } from "@/lib/agent-api/sandbox/api";
import { sandboxConfig, SANDBOX_CUSTOMER } from "@/lib/agent-api/sandbox/config";
import { decideSandboxProposal } from "@/lib/agent-api/sandbox/ledger";
import { createSandboxSession, sandboxTransaction } from "@/lib/agent-api/sandbox/store";
import { AGENT_SCOPES } from "@/lib/agent-api/keys";
import { requireConsentLab } from "@/lib/agent-api/customer-identity";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { pairingDb } from "@/concept/pairing/db";
import { PostgresNotifications } from "@/concept/store/postgres-notifications";

const origin = "https://sandbox.example.test";
const serviceToken = randomBytes(32).toString("hex");
const installation = process.env.SANDBOX_TEST_INSTALLATION_ID!;
const scopes = AGENT_SCOPES;
const routes = {
  access: "GET /api/v1/access",
  services: "GET /api/v1/services",
  availability: "GET /api/v1/availability",
  propose: "POST /api/v1/proposals",
  proposal: "GET /api/v1/proposals/{id}",
  book: "POST /api/v1/bookings",
  booking: "GET /api/v1/bookings/{id}",
} as const;
type Route = (typeof routes)[keyof typeof routes];
const bind = (route: Route, id?: string) => route.split(" ")[1].replace("{id}", id ?? "");

async function call(route: Route, key: string, options: { id?: string; query?: string; body?: unknown; gateway?: boolean; replay?: string } = {}) {
  const method = route.split(" ")[0];
  const headers = new Headers({ host: new URL(origin).host, authorization: "Bearer " + key });
  if (options.gateway !== false) headers.set("x-booking-gateway-token", serviceToken);
  if (options.body) headers.set("content-type", "application/json");
  if (options.replay) headers.set("idempotency-key", options.replay);
  const response = await sandboxAgentRoute(new Request(origin + bind(route, options.id) + (options.query ?? ""), {
    method, headers, body: options.body ? JSON.stringify(options.body) : undefined,
  }), route, scopes);
  return { status: response.status, data: await response.json(), headers: response.headers };
}

describe.skipIf(process.env.BOOKING_SANDBOX_TESTS !== "1")("isolated sandbox provider", () => {
  let first: Awaited<ReturnType<typeof createSandboxSession>>;
  let second: typeof first;

  beforeAll(async () => {
    for (const [key, value] of Object.entries({
      BOOKING_SANDBOX: "1", BOOKING_CONSENT_DELIVERY: "sandbox-demo-phone", BOOKING_SANDBOX_ORIGIN: origin,
      BOOKING_SANDBOX_DB_ID: installation, BOOKING_SERVICE_ROLE: "salon", BOOKING_RUNTIME: "local",
      BOOKING_PUBLIC_ORIGIN: "https://gateway.example.test", GATEWAY_SERVICE_TOKEN: serviceToken,
      SESSION_SECRET: randomBytes(32).toString("hex"),
    })) vi.stubEnv(key, value);
    first = await sandboxTransaction(createSandboxSession);
    second = await sandboxTransaction(createSandboxSession);
  });
  afterAll(() => vi.unstubAllEnvs());

  it("refuses wrong flags, labs, installs, ordinary DB access and the wrong host", async () => {
    expect(() => sandboxConfig({ ...process.env, BOOKING_SANDBOX: "0" })).toThrow();
    for (const flag of ["BOOKING_CONSENT_LAB", "BOOKING_SMS_OTP_LAB", "BOOKING_OAUTH_LAB", "ASSISTANT_PAIRING"])
      expect(() => sandboxConfig({ ...process.env, [flag]: "1" })).toThrow();
    expect(() => sandboxConfig({ ...process.env, BOOKING_CONSENT_DELIVERY: "staging-inbox" })).toThrow();
    expect(() => sandboxConfig({ ...process.env, CONCEPT_AI_BASE_URL: "0" })).toThrow();
    expect(() => requireConsentLab()).toThrow();
    expect(proxy(new NextRequest(origin + "/admin", { headers: { host: new URL(origin).host } })).status).toBe(404);
    expect(proxy(new NextRequest(origin + "/api/v1/access", { headers: { host: "other.example.test" } })).status).toBe(404);
    vi.stubEnv("BOOKING_SANDBOX_DB_ID", randomUUID());
    expect((await call(routes.access, first.key)).status).toBe(503);
    vi.stubEnv("BOOKING_SANDBOX_DB_ID", installation);
    const ordinary = createDatabaseClient();
    const invalidSandbox = createDatabaseClient(process.env.SANDBOX_ORDINARY_DATABASE_URL, 1, "sandbox");
    try {
      await expect(ordinary.$queryRaw`SELECT 1`).rejects.toThrow();
      await expect(invalidSandbox.$queryRaw`SELECT 1`).rejects.toThrow();
      vi.stubEnv("ASSISTANT_PAIRING", "1");
      vi.stubEnv("PAIRING_DATABASE_URL", process.env.DATABASE_URL);
      try {
        await expect(pairingDb().$queryRaw`SELECT 1`).rejects.toThrow();
      } finally {
        await pairingDb().$disconnect();
        vi.stubEnv("ASSISTANT_PAIRING", undefined);
        vi.stubEnv("PAIRING_DATABASE_URL", undefined);
      }
      const onReady = vi.fn();
      const notify = new PostgresNotifications(process.env.DATABASE_URL!, vi.fn(), onReady);
      notify.start();
      await new Promise(resolve => setTimeout(resolve, 80));
      notify.stop();
      expect(onReady).not.toHaveBeenCalled();
      await expect(sandboxTransaction(tx => tx.$executeRaw`
        UPDATE cresavo_sandbox.installation SET id = ${randomUUID()}::uuid
      `)).rejects.toThrow();
      await expect(sandboxTransaction(tx => tx.$executeRaw`
        UPDATE cresavo_sandbox.generation SET generation = generation + 1
      `)).rejects.toThrow();
    } finally {
      await Promise.all([ordinary.$disconnect(), invalidSandbox.$disconnect()]);
    }
    expect((await call(routes.access, first.key, { gateway: false })).status).toBe(401);
    expect((await call(routes.access, "unrelated")).status).toBe(401);
    expect((await call(routes.access, first.key)).data.providerMode).toBe("split");
  });

  it("keeps identical displayed slots, credentials, approvals and bookings isolated", async () => {
    let future = DateTime.now().setZone("Europe/Stockholm").plus({ days: 3 });
    while (future.weekday > 5) future = future.plus({ days: 1 });
    const date = future.toISODate()!;
    async function terms(pair: typeof first) {
      const catalog = await call(routes.services, pair.key, { query: "?business=demo" });
      expect(catalog.status).toBe(200);
      const service = catalog.data.services[0];
      const availability = await call(routes.availability, pair.key, {
        query: `?business=demo&service=${service.id}&date=${date}`,
      });
      expect(availability.status).toBe(200);
      return { business: "demo", serviceId: service.id, serviceVersion: service.version, staffId: service.staff[0].id,
        start: availability.data.slots[0].start };
    }
    const a = await terms(first);
    const b = await terms(second);
    expect(a.start).toBe(b.start);
    expect(a.serviceId).not.toBe(b.serviceId);
    expect((await call(routes.propose, second.key, { body: a })).data.error.code).toBe("service_not_found");
    const created = await Promise.all([
      call(routes.propose, first.key, { body: a }), call(routes.propose, second.key, { body: b }),
    ]);
    expect(created.map(row => row.status)).toEqual([201, 201]);
    const [pa, pb] = created.map(row => row.data.proposal);
    expect(JSON.stringify(created[0].data)).not.toMatch(/approvalUrl|token|mandateId/);
    expect((await call(routes.proposal, second.key, { id: pa.id })).status).toBe(404);
    const book = (pair: typeof first, input: typeof a, mandateId?: string, replay = randomUUID()) =>
      call(routes.book, pair.key, { replay, body: { ...input, confirmed: true, mandateId, customer: { email: "ignored@example.test", name: "Ignored" } } });
    expect((await book(first, a)).data.error.code).toBe("mandate_required");
    const pending = await sandboxTransaction(tx => tx.agentProposal.findUniqueOrThrow({ where: { id: pa.id } }));
    await expect(sandboxTransaction(tx => decideSandboxProposal(tx, second.session, pa.id, pending.proposalHash, "yes")))
      .rejects.toThrow();
    async function approve(pair: typeof first, id: string) {
      await sandboxTransaction(async tx => {
        const row = await tx.agentProposal.findUniqueOrThrow({ where: { id } });
        await decideSandboxProposal(tx, pair.session, id, row.proposalHash, "yes");
      });
      return (await call(routes.proposal, pair.key, { id })).data.proposal.mandateId as string;
    }
    const [ma, mb] = await Promise.all([approve(first, pa.id), approve(second, pb.id)]);
    await expect(approve(first, pa.id)).rejects.toThrow();
    expect((await book(second, b, ma)).data.error.code).toBe("mandate_denied");
    const replayKey = randomUUID();
    const [bookedA, bookedB] = await Promise.all([book(first, a, ma, replayKey), book(second, b, mb)]);
    expect([bookedA.status, bookedB.status]).toEqual([201, 201]);
    expect(bookedA.data.booking.id).not.toBe(bookedB.data.booking.id);
    expect((await book(first, a, ma, replayKey)).data.replayed).toBe(true);
    expect((await call(routes.booking, second.key, { id: bookedA.data.booking.id })).status).toBe(404);
    const stored = await sandboxTransaction(tx => tx.booking.findMany({ where: { id: { in: [bookedA.data.booking.id, bookedB.data.booking.id] } } }));
    expect(stored.map(row => row.customerEmail)).toEqual([SANDBOX_CUSTOMER.email, SANDBOX_CUSTOMER.email]);
  });

  it.skipIf(!process.env.SANDBOX_GATEWAY_CHECKOUT)("passes the gateway provider checker against the local sandbox", async () => {
    const pair = await sandboxTransaction(createSandboxSession);
    const routeMap: Record<string, Route> = Object.fromEntries(Object.values(routes).map(route => [route, route]));
    const server = createServer(async (incoming, outgoing) => {
      try {
        const url = new URL(incoming.url ?? "/", "http://127.0.0.1");
        const path = url.pathname.replace(/(\/api\/v1\/(?:proposals|bookings))\/[^/]+$/, "$1/{id}");
        const route = routeMap[incoming.method + " " + path];
        const headers = new Headers(incoming.headers as Record<string, string>);
        headers.set("host", new URL(origin).host);
        const options: RequestInit & { duplex: "half" } = { method: incoming.method, headers, duplex: "half",
          body: incoming.method === "POST" ? Readable.toWeb(incoming as IncomingMessage) as ReadableStream : undefined };
        const response = await sandboxAgentRoute(new Request(origin + url.pathname + url.search, options), route, scopes);
        outgoing.writeHead(response.status, Object.fromEntries(response.headers)).end(Buffer.from(await response.arrayBuffer()));
      } catch {
        outgoing.writeHead(500).end();
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw Error("CHECK_SERVER_ADDRESS");
      const child = spawn(process.execPath, ["scripts/provider-check.js", "--write"], {
        cwd: process.env.SANDBOX_GATEWAY_CHECKOUT,
        env: { NODE_ENV: "test", PATH: process.env.PATH, PROVIDER_ORIGIN: "http://127.0.0.1:" + address.port,
          PROVIDER_BUSINESS: "demo", GATEWAY_SERVICE_TOKEN: serviceToken, PROVIDER_AGENT_KEY: pair.key },
        stdio: ["ignore", "pipe", "ignore"],
      });
      const chunks: Buffer[] = [];
      child.stdout.on("data", chunk => chunks.push(chunk));
      const [code] = await once(child, "close");
      const output = Buffer.concat(chunks).toString("utf8");
      expect(output.includes(serviceToken) || output.includes(pair.key)).toBe(false);
      // Print only allowlisted check IDs. Never emit arbitrary provider stdout.
      const lines = output.match(/^(PASS|WARN|FAIL|SKIP) +[a-z_]+/gm) ?? [];
      for (const line of lines) console.info(line);
      expect(code).toBe(0);
      expect(lines.length).toBeGreaterThan(10);
      expect(lines.every(line => line.startsWith("PASS"))).toBe(true);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }, 20_000);
});
