// Local-only regression for a salon started without either split setting.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { assertTestDatabase } from "../test-db-guard.mjs";
import { db } from "../../src/lib/db";
import { createAgentApiKey } from "../../src/lib/agent-api/keys";

assertTestDatabase();
function localAddress(value: string | undefined) {
  const url = new URL(value ?? "");
  assert.equal(url.protocol, "http:");
  assert.equal(url.hostname, "127.0.0.1");
  return url;
}
const salon = localAddress(process.env.AGENTPROV_SALON_URL);
const gateway = localAddress(process.env.AGENTPROV_BASE_URL);
assert.notEqual(salon.origin, gateway.origin);
assert(!process.env.VERCEL && !process.env.VERCEL_ENV);
const name = "provider-mode-" + randomUUID();
let clientId: string | undefined;
try {
  const { key, record } = await createAgentApiKey({
    businessId: "demo", agentName: name,
    ownerName: "Synthetic operator", ownerContact: "operator@example.test", kind: "demo-script",
  }, db);
  clientId = record.clientId;
  const headers = { authorization: "Bearer " + key, "content-type": "application/json" };
  const direct = await fetch(new URL("/api/v1/access", salon), { headers, redirect: "error" });
  assert.equal(direct.status, 200);
  assert.equal((await direct.json()).providerMode, "standalone");
  const before = await db.booking.count();
  for (const [method, path] of [
    ["GET", "/api/v1/services"], ["GET", "/api/v1/availability"],
    ["GET", "/api/v1/bookings/synthetic-missing"], ["POST", "/api/v1/bookings"],
    ["POST", "/api/v1/bookings/synthetic-missing/cancel"],
    ["GET", "/api/v1/proposals/synthetic-missing"], ["POST", "/api/v1/proposals"],
    ["GET", "/api/v1/mcp/schema"], ["POST", "/api/v1/mcp"],
  ]) {
    const response = await fetch(new URL(path, gateway), {
      method, headers, redirect: "error",
      ...(method === "POST" ? { body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name, version: "1" } } }) } : {}),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "provider_configuration_invalid");
  }
  assert.equal(await db.booking.count(), before);
  console.log("PASS LEGACY_PROVIDER_REFUSED_NINE_OPERATIONS");
} catch {
  console.error("FAIL LEGACY_PROVIDER_MODE_CHECK");
  process.exitCode = 1;
} finally {
  if (clientId) {
    await db.agentApiKey.deleteMany({ where: { clientId } });
    await db.agentClient.deleteMany({ where: { id: clientId } });
  }
  await db.$disconnect();
}
