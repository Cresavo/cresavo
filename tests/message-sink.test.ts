import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messageReference } from "@/concept/booking/messages";
import { connectionError, fail, ok, type PortResult } from "@/concept/connections/core";
import type { EmailMessage, EmailPort, EmailReceipt } from "@/concept/connections/ports/email";
import { configFromEnv } from "@/concept/connections/server/config";
import { createRegistry } from "@/concept/connections/server/registry";
import { createOutbox } from "@/concept/connections/simulated/outbox";
import { createDemoState } from "@/concept/data/generate";
import type { Booking, DemoState } from "@/concept/data/types";
import type { EffectDelivery } from "@/concept/store/effect-outbox";
import { verifyBookingToken } from "@/lib/booking-token";
import { messageSink } from "@/lib/message-sink";

// The message sink with a stub database and a recording e-mail adapter.
// Nothing is sent: there is no provider. Fictional data, fixed dates.

const TENANT = "tenant-fiktiv";
const base = createDemoState("2026-11-16");
const booking: Booking = {
  id: "b-1", customerId: base.customers[0].id, staffId: base.staff[0].id, serviceId: base.services[0].id, date: "2026-11-24", start: 600,
  duration: 60, price: 500, status: "booked", source: "online", contactEmail: "lisa@example.test",
};

const sent: EmailMessage[] = [];
let outcome: PortResult<EmailReceipt>;
const adapter = { send: async (message: EmailMessage) => { sent.push(message); return outcome; } } as unknown as EmailPort;
const registry = { resolve: async () => ({ adapter, live: true, reason: "live" as const }) };

let doc: DemoState | undefined;
const prisma = { $queryRaw: async () => doc ? [{ doc }] : [] } as unknown as PrismaClient;

const delivery = (over: Partial<{ id: string; port: "email" | "sms"; reference: string }> = {}): EffectDelivery => ({
  id: over.id ?? "effect-1", tenantId: TENANT, tenantKind: "salon", seq: 1, n: 0,
  effect: { kind: "message", record: { id: "o-1", port: over.port ?? "email", action: "send", to: `customer:${booking.customerId}`, body: "x", cost: null, reference: over.reference ?? messageReference(booking, "confirmation", "email") } },
});
const withBooking = (over: Partial<Booking> = {}, customers = base.customers): DemoState => ({ ...base, customers, bookings: [{ ...booking, ...over }] });

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "synthetic-session-secret-of-32-chars!!");
  sent.length = 0;
  outcome = ok({ id: "m-1", to: ["lisa@example.test"] }, "sent");
  doc = withBooking();
});
afterEach(() => vi.unstubAllEnvs());

describe("the message sink", () => {
  it("sends one e-mail to the booking's address, keyed by the delivery id", async () => {
    expect(await messageSink(prisma, registry)(delivery({ id: "effect-9" }))).toBeUndefined();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: ["lisa@example.test"], idempotencyKey: "effect-9", language: base.localization.language });
    expect(sent[0].subject).toContain("2026");
  });

  it("falls back to the customer's address when the booking has none", async () => {
    doc = withBooking({ contactEmail: undefined }, base.customers.map((c) => ({ ...c, email: "kund@example.test" })));
    await messageSink(prisma, registry)(delivery());
    expect(sent[0].to).toEqual(["kund@example.test"]);
  });

  it("puts a token for this booking in the link, made at delivery", async () => {
    await messageSink(prisma, registry)(delivery());
    const token = /#t=(v1\.[^\s"]+)/.exec(sent[0].text)![1];
    expect(verifyBookingToken(token, { tenantId: TENANT, bookingId: "b-1", customerId: booking.customerId, purpose: "manage" }, Date.parse("2026-11-20T10:00:00Z"))).toBe(true);
  });

  it.each([
    ["an erased customer", () => { doc = withBooking({ contactEmail: undefined }, []); }],
    ["no address", () => { doc = withBooking({ contactEmail: undefined }, base.customers.map((c) => ({ ...c, email: "" }))); }],
    ["a malformed address", () => { doc = withBooking({ contactEmail: "not-an-address" }); }],
    ["a cancelled booking", () => { doc = withBooking({ status: "cancelled" }); }],
    ["a missing booking", () => { doc = { ...base, bookings: [] }; }],
    ["a missing tenant", () => { doc = undefined; }],
  ])("skips, acknowledged and unsent, for %s", async (_name, arrange) => {
    arrange();
    expect(await messageSink(prisma, registry)(delivery())).toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it("acknowledges SMS and anything that is not a booking message without sending", async () => {
    await messageSink(prisma, registry)(delivery({ port: "sms" }));
    await messageSink(prisma, registry)(delivery({ reference: "campaign-1-newsletter" }));
    expect(sent).toHaveLength(0);
  });

  it("fails at once on a permanent error and throws on a retryable one", async () => {
    outcome = fail(connectionError("email", "resend", "invalid_input"));
    expect(await messageSink(prisma, registry)(delivery())).toBe("failed");
    outcome = fail(connectionError("email", "resend", "rejected"));
    expect(await messageSink(prisma, registry)(delivery())).toBe("failed");
    for (const code of ["timeout", "rate_limited", "provider_unavailable", "network", "unauthorized"] as const) {
      outcome = fail(connectionError("email", "resend", code));
      await expect(messageSink(prisma, registry)(delivery())).rejects.toThrow("EMAIL_RETRYABLE");
    }
  });
});

describe("the public demo and an unconfigured server", () => {
  const outbox = () => createOutbox();

  it("never send for real without the live flags: the simulated adapter records only", async () => {
    const fetch = vi.fn();
    const recorded = outbox();
    const sink = messageSink(prisma, createRegistry({ configFor: () => configFromEnv({}), outbox: recorded, fetch }));
    await sink(delivery());
    await sink(delivery());
    expect(fetch).not.toHaveBeenCalled();
    expect(recorded.list("email")).toHaveLength(1);
    expect(recorded.list("email")[0].to).toBe("lisa@example.test");
  });

  it("ignore live flags and a key in the public demo", async () => {
    const fetch = vi.fn();
    const env = { CONCEPT_CONNECTIONS_LIVE: "1", CONCEPT_EMAIL_PROVIDER: "resend", RESEND_API_KEY: "synthetic-key", PUBLIC_READONLY: "1" };
    const resolution = await createRegistry({ configFor: () => configFromEnv(env), secrets: { get: async (_b, name) => env[name as keyof typeof env], has: async () => true }, outbox: outbox(), fetch }).resolve("email", TENANT);
    expect(resolution).toMatchObject({ live: false, reason: "public-demo" });
    await messageSink(prisma, { resolve: async () => resolution })(delivery());
    expect(fetch).not.toHaveBeenCalled();
  });
});
