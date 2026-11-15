// Standalone REST client: no database, domain or MCP imports.
import { createInterface } from "node:readline";

const base = process.env.AGENTPROV_BASE_URL!;
const key = process.env.AGENTPROV_KEY!;
if (!base || !key) throw new Error("PROOF_CONFIG_MISSING");
for await (const line of createInterface({ input: process.stdin })) {
  try {
    const { id, method, path, body, idempotencyKey } = JSON.parse(line);
    const response = await fetch(new URL(path, base), {
      method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json",
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    process.stdout.write(JSON.stringify({ id, status: response.status, body: await response.json() }) + "\n");
  } catch {
    process.stdout.write(JSON.stringify({ failure: "REST_TRANSPORT_FAILED" }) + "\n");
  }
}
