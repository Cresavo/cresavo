import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { configFromEnv } from "@/concept/connections/server/config";
import { describeConnections } from "@/concept/connections/server/overview";
import { createRegistry } from "@/concept/connections/server/registry";
import { memorySecretStore } from "@/concept/connections/server/secrets";
import { handleWebhook } from "@/concept/connections/server/webhooks";
import { createOutbox } from "@/concept/connections/simulated/outbox";
import { scriptedFetch } from "./helpers/connections-fetch";

const SECRETS = { STRIPE_SECRET_KEY: "sk_test_SECRET0123456789abcdef", STRIPE_WEBHOOK_SECRET: "whsec_SECRETstripehook0123" };
const registry = (env: Record<string, string>) =>
  createRegistry({ configFor: () => configFromEnv(env), secrets: memorySecretStore(SECRETS), fetch: scriptedFetch().fetch, outbox: createOutbox() });
const live = { CONCEPT_CONNECTIONS_LIVE: "1", CONCEPT_PAYMENTS_PROVIDER: "stripe" };
const body = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded", data: { object: { object: "payment_intent", id: "pi_1", amount: 100, currency: "sek" } } });
const signed = (rawBody: string) => {
  const t = Math.floor(Date.now() / 1000);
  return new Request("https://salon.example/api/concept/connections/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": `t=${t},v1=${createHmac("sha256", SECRETS.STRIPE_WEBHOOK_SECRET).update(`${t}.${rawBody}`).digest("hex")}` },
    body: rawBody,
  });
};

describe("webhook endpoint", () => {
  it("verifies a live provider's signature but does not claim to handle the event yet", async () => {
    const response = await handleWebhook(signed(body), "stripe", "b", registry(live), {});
    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({ verified: true, handled: false });
  });

  it("rejects a bad signature", async () => {
    const request = new Request("https://salon.example/h", { method: "POST", headers: { "stripe-signature": "t=1,v1=00" }, body });
    expect((await handleWebhook(request, "stripe", "b", registry(live), {})).status).toBe(400);
  });

  it("answers 404 in the public demo, when live is off, and for unknown or unselected providers", async () => {
    expect((await handleWebhook(signed(body), "stripe", "b", registry({ ...live, NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO: "1" }), {})).status).toBe(404);
    expect((await handleWebhook(signed(body), "stripe", "b", registry({ CONCEPT_PAYMENTS_PROVIDER: "stripe" }), {})).status).toBe(404);
    expect((await handleWebhook(signed(body), "twilio", "b", registry(live), {})).status).toBe(404);
    expect((await handleWebhook(signed(body), "simulated", "b", registry(live), {})).status).toBe(404);
  });

  it("refuses oversized bodies", async () => {
    expect((await handleWebhook(signed("x".repeat(300 * 1024)), "stripe", "b", registry(live), {})).status).toBe(413);
  });
});

describe("connections overview", () => {
  it("shows every port simulated in the public demo, with no secret values", async () => {
    const overview = await describeConnections("b", registry({ ...live, PUBLIC_READONLY: "1" }));
    expect(overview.ports).toHaveLength(8);
    expect(overview.ports.every((p) => p.provider === "simulated" && p.reason === "public-demo" && !p.live)).toBe(true);
    expect(overview.providers.some((p) => p.provider === "46elks" && p.region === "Nordics")).toBe(true);
    const text = JSON.stringify(overview);
    for (const value of Object.values(SECRETS)) expect(text).not.toContain(value);
  });
});
