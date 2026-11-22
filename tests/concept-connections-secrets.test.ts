import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROVIDERS } from "@/concept/connections/providers";
import { configFromEnv } from "@/concept/connections/server/config";
import { clearTokenCache } from "@/concept/connections/server/oauth";
import { createRegistry } from "@/concept/connections/server/registry";
import { envSecretStore, isSecretName, memorySecretStore } from "@/concept/connections/server/secrets";
import { createOutbox } from "@/concept/connections/simulated/outbox";
import { KEY_SHAPED, networkError, scriptedFetch } from "./helpers/connections-fetch";

// Invented secrets for every provider, all containing "SECRET" so a leak is easy to spot.
const SECRETS: Record<string, string> = {
  TWILIO_ACCOUNT_SID: "AC0123456789abcdef0123456789abcdef",
  TWILIO_AUTH_TOKEN: "SECRETtwilio0123456789",
  ELKS_API_USERNAME: "u0123456789",
  ELKS_API_PASSWORD: "SECRETelks0123456789",
  ELKS_WEBHOOK_TOKEN: "SECRETelkshook0123456789",
  RESEND_API_KEY: "re_SECRET_0123456789abcdef",
  RESEND_WEBHOOK_SECRET: "whsec_U0VDUkVUcmVzZW5kaG9vaw==",
  POSTMARK_SERVER_TOKEN: "SECRETpostmark0123456789",
  POSTMARK_WEBHOOK_PASSWORD: "SECRETpostmarkhook0123",
  STRIPE_SECRET_KEY: "sk_test_SECRET0123456789abcdef",
  STRIPE_WEBHOOK_SECRET: "whsec_SECRETstripehook0123",
  FORTNOX_CLIENT_ID: "fortnox-client",
  FORTNOX_CLIENT_SECRET: "SECRETfortnoxclient",
  FORTNOX_REFRESH_TOKEN: "SECRETfortnoxrefresh",
  VISMA_CLIENT_ID: "visma-client",
  VISMA_CLIENT_SECRET: "SECRETvismaclient",
  VISMA_REFRESH_TOKEN: "SECRETvismarefresh",
  GOOGLE_OAUTH_CLIENT_ID: "google-client",
  GOOGLE_OAUTH_CLIENT_SECRET: "SECRETgoogleclient",
  GOOGLE_CALENDAR_REFRESH_TOKEN: "1//SECRETgooglerefresh0123456789",
  MS_GRAPH_CLIENT_ID: "graph-client",
  MS_GRAPH_CLIENT_SECRET: "SECRETgraphclient",
  MS_GRAPH_REFRESH_TOKEN: "SECRETgraphrefresh",
  GOOGLE_RESERVE_BOOKING_PASSWORD: "SECRETreservebooking0123",
  META_PAGE_ACCESS_TOKEN: "EAASECRETmetapagetoken0123456789",
  META_APP_SECRET: "SECRETmetaappsecret",
};
const SETTINGS = { TWILIO_FROM: "+15005550006", ELKS_FROM: "Salon", META_PAGE_ID: "1234567890", META_INSTAGRAM_USER_ID: "17841400000000000", MS_GRAPH_USER: "owner@salon.example", GOOGLE_RESERVE_BOOKING_USER: "google" };
const values = Object.values(SECRETS).filter((v) => v.includes("SECRET"));

/** A provider error that echoes every secret back, as a careless provider or proxy might. */
const echo = { message: `bad credentials ${values.join(" ")}`, error: { message: values.join(" "), code: values[0], type: "x" }, name: values[1], ErrorCode: values[2] };

function assertClean(label: string, output: unknown) {
  const text = JSON.stringify(output);
  for (const value of values) expect(text, `${label} leaked a secret`).not.toContain(value);
  for (const pattern of KEY_SHAPED) expect(text, `${label} matched ${pattern}`).not.toMatch(pattern);
}

const logged: string[] = [];
beforeEach(() => {
  clearTokenCache();
  logged.length = 0;
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => { logged.push(args.map(String).join(" ")); });
  }
});
afterEach(() => vi.restoreAllMocks());

async function exercise(definition: (typeof PROVIDERS)[number], reply: Parameters<typeof scriptedFetch>[0]) {
  const replies = Array.from({ length: 8 }, () => reply);
  const { fetch } = scriptedFetch(...replies);
  const adapter = definition.create({ secrets: SECRETS, settings: SETTINGS, fetch }) as unknown as Record<string, (...args: unknown[]) => unknown>;
  const webhook = { url: "https://salon.example/h?token=wrong", method: "POST", headers: { authorization: "Basic x", "stripe-signature": "t=1,v1=00" }, rawBody: JSON.stringify(echo), nowSeconds: 1 };
  const calls: Record<string, unknown[]> = {
    send: [{ to: definition.info.port === "email" ? ["guest@example.com"] : "+46700000001", from: "hello@salon.example", subject: "S", text: "T", body: "B" }],
    verifyWebhook: [webhook],
    createCheckout: [{ amount: { amountMinor: 49900, currency: "SEK" }, description: "Cut", reference: "b-1", successUrl: "https://salon.example/ok", cancelUrl: "https://salon.example/no", idempotencyKey: "k" }],
    createPaymentLink: [{ amount: { amountMinor: 49900, currency: "SEK" }, description: "Cut", reference: "b-1", idempotencyKey: "k" }],
    refund: [{ paymentId: "pi_1", idempotencyKey: "k" }],
    postVoucher: [{ date: "2026-11-16", description: "Day", currency: "SEK", reference: "d", rows: [{ account: "1580", debitMinor: 100, creditMinor: 0 }, { account: "3001", debitMinor: 0, creditMinor: 100 }] }],
    pushEvent: ["primary", { id: "b-1", title: "Cut", start: "2026-11-18T09:00:00Z", end: "2026-11-18T09:45:00Z", timeZone: "Europe/Stockholm" }],
    deleteEvent: ["primary", "bk0123456789"],
    pullEvents: [{ calendarId: "primary", from: "2026-11-18T00:00:00Z", to: "2026-11-25T00:00:00Z" }],
    authenticateBookingCall: [webhook],
    publish: [{ channel: "instagram", caption: "Hi", imageUrl: "https://salon.example/a.jpg", reference: "c-1" }],
    createDraft: [{ name: "x" }],
  };
  const outputs: unknown[] = [];
  for (const [method, args] of Object.entries(calls)) {
    if (typeof adapter[method] === "function") outputs.push(await adapter[method](...args));
  }
  return outputs;
}

describe("no secret in any adapter output or log", () => {
  it.each(PROVIDERS.map((d) => [d.info.provider, d] as const))("%s", async (name, definition) => {
    const outputs = [
      ...(await exercise(definition, { status: 401, body: echo })),
      ...(await exercise(definition, { status: 500, body: `<html>${values.join(" ")}</html>` })),
      ...(await exercise(definition, networkError())),
    ];
    assertClean(name, outputs);
    assertClean(`${name} logs`, logged);
  });

  it("adapter sources never log and hold no key-shaped literal", () => {
    const root = join(process.cwd(), "src/concept/connections");
    const files: string[] = [];
    const walk = (dir: string) => readdirSync(dir).forEach((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : files.push(join(dir, name))));
    walk(root);
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/console\.(log|info|warn|error|debug)/);
      for (const pattern of KEY_SHAPED.filter((p) => !String(p).includes("Bearer") && !String(p).includes("Basic") && !String(p).includes("SECRET"))) expect(source, file).not.toMatch(pattern);
      expect(source, file).not.toMatch(/process\.env\.NEXT_PUBLIC_[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD)/);
    }
  });
});

describe("secret store", () => {
  it("reads only server-side names and never NEXT_PUBLIC_ ones", async () => {
    const store = envSecretStore({ STRIPE_SECRET_KEY: " sk_test_x ", NEXT_PUBLIC_STRIPE_SECRET_KEY: "leak", EMPTY: "" });
    expect(await store.get("b", "STRIPE_SECRET_KEY")).toBe("sk_test_x");
    expect(await store.get("b", "NEXT_PUBLIC_STRIPE_SECRET_KEY")).toBeUndefined();
    expect(await store.has("b", "EMPTY")).toBe(false);
    expect(isSecretName("NEXT_PUBLIC_X_KEY")).toBe(false);
    expect(isSecretName("lowercase")).toBe(false);
  });

  it("every provider names only valid server-side secrets", () => {
    for (const definition of PROVIDERS) for (const name of [...definition.secrets, ...(definition.optionalSecrets ?? []), ...definition.info.secrets]) expect(isSecretName(name), name).toBe(true);
  });
});

describe("registry", () => {
  const env = { CONCEPT_CONNECTIONS_LIVE: "1", CONCEPT_SMS_PROVIDER: "twilio", CONCEPT_PAYMENTS_PROVIDER: "stripe", CONCEPT_EMAIL_PROVIDER: "smtp", ...SETTINGS };
  const registry = (extra: Record<string, string>, secrets = SECRETS) => {
    const { fetch, calls } = scriptedFetch();
    return { calls, registry: createRegistry({ configFor: () => configFromEnv({ ...env, ...extra }), secrets: memorySecretStore(secrets), fetch, outbox: createOutbox() }) };
  };

  it("fingerprints the account of a live adapter without revealing a key, and not at all for a simulated one", async () => {
    const { registry: r } = registry({});
    const a = (await r.resolve("sms", "b")).account;
    const b = (await new Promise<typeof r>((resolve) => resolve(registry({}, { ...SECRETS, TWILIO_AUTH_TOKEN: "SECRETother01234567ab" }).registry))).resolve;
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    expect((await b("sms", "b")).account).not.toBe(a);
    expect(JSON.stringify(a)).not.toContain("SECRET");
    expect((await r.resolve("calendar", "b")).account).toBeUndefined();
  });

  it("uses the live adapter only when selected, switched on and fully configured", async () => {
    const { registry: r } = registry({});
    expect(await r.resolve("sms", "b")).toMatchObject({ live: true, reason: "live", adapter: { info: { provider: "twilio" } } });
    expect(await r.resolve("calendar", "b")).toMatchObject({ live: false, reason: "not-selected", adapter: { info: { provider: "simulated" } } });
  });

  it("the public demo is always simulated, whatever else is configured", async () => {
    for (const flag of [{ NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO: "1" }, { PUBLIC_READONLY: "1" }] as Record<string, string>[]) {
      const { registry: r, calls } = registry(flag);
      const resolution = await r.resolve("sms", "b");
      expect(resolution).toMatchObject({ live: false, reason: "public-demo", adapter: { info: { kind: "simulated" } } });
      await resolution.adapter.send({ to: "+46700000001", body: "Hi" });
      expect(calls).toHaveLength(0);
    }
  });

  it("stays simulated with the master switch off, an unknown provider or a missing secret, and names what is missing", async () => {
    expect(await registry({ CONCEPT_CONNECTIONS_LIVE: "0" }).registry.resolve("sms", "b")).toMatchObject({ live: false, reason: "live-off", selected: "twilio" });
    const unknown = await registry({ CONCEPT_SMS_PROVIDER: "sk_live_pastedintowrongvariable" }).registry.resolve("sms", "b");
    expect(unknown).toMatchObject({ live: false, reason: "unknown-provider" });
    expect(unknown).not.toHaveProperty("selected");
    expect(await registry({ TWILIO_FROM: "" }).registry.resolve("sms", "b")).toMatchObject({ live: false, reason: "missing-setting", missing: ["TWILIO_FROM"] });
    const partial = Object.fromEntries(Object.entries(SECRETS).filter(([name]) => name !== "TWILIO_AUTH_TOKEN"));
    const missing = await registry({}, partial).registry.resolve("sms", "b");
    expect(missing).toMatchObject({ live: false, reason: "missing-secret", missing: ["TWILIO_AUTH_TOKEN"] });
    assertClean("resolution", { ...missing, adapter: missing.adapter.info });
  });

  it("a public-demo build stays simulated even when runtime settings say otherwise", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO", "1");
    try {
      const config = await import("@/concept/connections/server/config");
      expect(config.configFromEnv({ ...env, PUBLIC_READONLY: "0", NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO: "0" }).publicDemo).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("an interface-only provider can never send", async () => {
    const resolution = await registry({}).registry.resolve("email", "b");
    expect(resolution).toMatchObject({ live: false, reason: "interface-only" });
    expect(await resolution.adapter.send({ to: ["a@example.com"], from: "b@example.com", subject: "s", text: "t" })).toMatchObject({ ok: false, error: { code: "not_supported" } });
  });

  it("passes only the settings a provider declares", async () => {
    const spy = vi.spyOn(PROVIDERS.find((d) => d.info.provider === "twilio")!, "create");
    await registry({ UNRELATED_SETTING: "x" }).registry.resolve("sms", "b");
    expect(Object.keys(spy.mock.calls[0][0].settings).sort()).toEqual(["TWILIO_FROM", "TWILIO_MESSAGING_SERVICE_SID"]);
    expect(Object.keys(spy.mock.calls[0][0].secrets).sort()).toEqual(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]);
  });
});
