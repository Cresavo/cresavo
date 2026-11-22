import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messageReference } from "@/concept/booking/messages";
import { connectionError, fail, ok, type PortResult } from "@/concept/connections/core";
import type { EmailMessage, EmailPort, EmailReceipt } from "@/concept/connections/ports/email";
import { configFromEnv } from "@/concept/connections/server/config";
import { createRegistry, type ResolutionReason } from "@/concept/connections/server/registry";
import { createOutbox, type DeliveryState } from "@/concept/connections/simulated/outbox";
import { createDemoState } from "@/concept/data/generate";
import type { Booking, DemoState } from "@/concept/data/types";
import type { EffectDelivery } from "@/concept/store/effect-outbox";
import { verifyBookingToken } from "@/lib/booking-token";
import { messageSink } from "@/lib/message-sink";

// The message sink with a stub database and a recording e-mail adapter.
// Nothing is sent: there is no provider. Fictional data, fixed dates.

const TENANT = "tenant-fiktiv";
const REF = "0b7e2c1a-4d5f-4a6b-9c8d-1e2f3a4b5c6d";
const T0 = Date.parse("2026-11-16T10:00:00+01:00");
const HOUR = 3_600_000;
const base = createDemoState("2026-11-16");
const booking: Booking = {
  id: "b-1", publicRef: REF, customerId: base.customers[0].id, staffId: base.staff[0].id, serviceId: base.services[0].id, date: "2026-11-24", start: 600,
  duration: 60, price: 500, status: "booked", source: "online", contactEmail: "lisa@example.test",
  protection: { terms: { version: 1, freeHours: 24, latePercent: 0, noShowPercent: 0, currency: "SEK", priceMinor: 50000, depositMinor: 0 } },
};

const sent: EmailMessage[] = [];
let outcome: PortResult<EmailReceipt>;
let provider = "resend";
const adapter = { info: { get provider() { return provider; } }, send: async (message: EmailMessage) => { sent.push(message); return outcome; } } as unknown as EmailPort;
let resolution: { live: boolean; reason: ResolutionReason };
const registry = { resolve: async () => ({ adapter, ...resolution }) };

let doc: DemoState | undefined;
/** What the effect row holds of the sink's bookkeeping, merged like the sink's UPDATE does. */
let stored: DeliveryState;
const prisma = {
  $queryRaw: async () => doc ? [{ doc }] : [],
  $executeRaw: async (_strings: TemplateStringsArray, patch: string) => {
    const merged: Record<string, unknown> = { ...stored, ...JSON.parse(patch) };
    for (const key of Object.keys(merged)) if (merged[key] === null) delete merged[key];
    stored = merged as DeliveryState;
  },
} as unknown as PrismaClient;

let clock = T0;
const run = (over: Partial<{ port: "email" | "sms"; reference: string }> = {}, signal = new AbortController().signal) => {
  const delivery: EffectDelivery = {
    id: "effect-1", tenantId: TENANT, tenantKind: "salon", seq: 1, n: 0,
    effect: { kind: "message", record: {
      id: "o-1", port: over.port ?? "email", action: "send", to: `customer:${booking.customerId}`, body: "x", cost: null,
      reference: over.reference ?? messageReference(booking, "confirmation", "email"), delivery: structuredClone(stored),
    } },
  };
  return messageSink(prisma, registry, () => clock)(delivery, signal);
};
const withBooking = (over: Partial<Booking> = {}, customers = base.customers): DemoState => ({ ...base, customers, bookings: [{ ...booking, ...over }] });
const noEmail = base.customers.map((c) => ({ ...c, email: "" }));
const profileEmail = base.customers.map((c) => ({ ...c, email: "profil@example.test" }));

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "synthetic-session-secret-of-32-chars!!");
  vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  sent.length = 0;
  stored = {};
  clock = T0;
  provider = "resend";
  resolution = { live: true, reason: "live" };
  outcome = ok({ id: "m-1", to: ["lisa@example.test"] }, "sent");
  doc = withBooking();
});
afterEach(() => vi.unstubAllEnvs());

describe("the message sink", () => {
  it("sends one e-mail to the booking's address, keyed by the delivery id, with tracking off", async () => {
    expect(await run()).toBeUndefined();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: ["lisa@example.test"], idempotencyKey: "effect-1", language: base.localization.language, tracking: false });
    expect(sent[0].subject).toContain("2026");
    expect(stored).toMatchObject({ sent: true, live: true, firstAttemptAt: T0 });
    expect(stored.mail).toBeUndefined();
  });

  it("puts a token for this booking in the link, made at delivery", async () => {
    await run();
    const token = /#t=(v1\.[^\s"]+)/.exec(sent[0].text)![1];
    expect(verifyBookingToken(token, { tenantId: TENANT, bookingId: "b-1", ref: REF, customerId: booking.customerId, purpose: "manage" }, Date.parse("2026-11-20T10:00:00Z"))).toBe(true);
    expect(sent[0].text).toContain(`/booking/${REF}#t=v1.${REF}.`);
    expect(sent[0].text).not.toContain("/booking/b-1");
  });

  it("acknowledges an effect an earlier, slow attempt already sent", async () => {
    stored = { sent: true };
    await run();
    expect(sent).toHaveLength(0);
  });

  it("sends an owner-made visit to the profile address, without a link when it has no public reference", async () => {
    doc = withBooking({ publicRef: undefined, contactEmail: undefined }, profileEmail);
    await run();
    expect(sent[0].to).toEqual(["profil@example.test"]);
    expect(sent[0].text).not.toContain("https://");
  });

  it("never falls back to the profile address for a public booking whose own address is gone (customer B erased)", async () => {
    // Customer A's visit was booked with B's address; erasing B cleared it. A's profile is not the recipient.
    doc = withBooking({ contactEmail: undefined }, profileEmail);
    expect(await run()).toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it.each([
    ["an erased customer", () => { doc = withBooking({ publicRef: undefined, contactEmail: undefined }, []); }],
    ["no address", () => { doc = withBooking({ publicRef: undefined, contactEmail: undefined }, noEmail); }],
    ["a malformed address", () => { doc = withBooking({ contactEmail: "not-an-address" }); }],
    ["a cancelled booking", () => { doc = withBooking({ status: "cancelled" }); }],
    ["a missing booking", () => { doc = { ...base, bookings: [] }; }],
    ["a missing tenant", () => { doc = undefined; }],
  ])("skips, acknowledged and unsent, for %s", async (_name, arrange) => {
    arrange();
    expect(await run()).toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it("acknowledges SMS and anything that is not a booking message without sending", async () => {
    await run({ port: "sms" });
    await run({ reference: "campaign-1-newsletter" });
    expect(sent).toHaveLength(0);
  });
});

describe("failures", () => {
  it("fails at once, with the reason, on a permanent error", async () => {
    outcome = fail(connectionError("email", "resend", "invalid_input"));
    expect(await run()).toBe("failed");
    expect(stored.reason).toBe("invalid_input");
    expect(stored.mail).toBeUndefined();
  });

  it("throws, for a retry, on a rate limit or a bad API key, and has sent nothing", async () => {
    for (const code of ["rate_limited", "unauthorized"] as const) {
      outcome = fail(connectionError("email", "resend", code));
      await expect(run()).rejects.toThrow("EMAIL_RETRYABLE");
      expect(stored.dispatched).toBeUndefined();
    }
  });

  it("retries a same-key request still in progress, and fails a changed body for reconciliation", async () => {
    outcome = fail(connectionError("email", "resend", "conflict", { providerCode: "concurrent_idempotent_requests" }));
    await expect(run()).rejects.toThrow("EMAIL_RETRYABLE");
    outcome = fail(connectionError("email", "resend", "conflict", { providerCode: "invalid_idempotent_request" }));
    expect(await run()).toBe("failed");
    expect(stored.reason).toBe("reconcile");
  });

  it("does not start a request past the deadline", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(run({}, controller.signal)).rejects.toThrow();
    expect(sent).toHaveLength(0);
  });
});

describe("a send that may have left", () => {
  const timeout = () => { outcome = fail(connectionError("email", "resend", "timeout")); };

  it("is retried on Resend within 23 hours, with the same key and the same message", async () => {
    timeout();
    await expect(run()).rejects.toThrow("EMAIL_UNCERTAIN");
    expect(stored.dispatched).toBe(true);
    // The salon renames itself and the free-cancellation deadline passes before the retry: the message stays as it was.
    doc = { ...withBooking(), salon: { ...base.salon, name: "Salong Omdöpt" } };
    clock = T0 + 22 * HOUR;
    outcome = ok({ id: "m-2", to: [] }, "sent");
    await run();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ idempotencyKey: sent[0].idempotencyKey, subject: sent[0].subject, text: sent[0].text, html: sent[0].html });
    expect(sent[1].html).not.toContain("Omdöpt");
  });

  it("goes to reconciliation on Resend after 23 hours, unsent", async () => {
    timeout();
    await expect(run()).rejects.toThrow("EMAIL_UNCERTAIN");
    clock = T0 + 23 * HOUR + 1;
    expect(await run()).toBe("failed");
    expect(stored.reason).toBe("uncertain");
    expect(sent).toHaveLength(1);
  });

  it("goes to reconciliation at once on Postmark, which ignores the key", async () => {
    provider = "postmark";
    timeout();
    expect(await run()).toBe("failed");
    expect(stored.reason).toBe("uncertain");
    expect(sent).toHaveLength(1);
  });

  it("is not repeated on Postmark after a crash left the request started", async () => {
    provider = "postmark";
    stored = { live: true, firstAttemptAt: T0, dispatched: true, mail: { subject: "s", text: "t", html: "h" } };
    expect(await run()).toBe("failed");
    expect(stored.reason).toBe("uncertain");
    expect(sent).toHaveLength(0);
  });

  it("still rechecks cancellation before a retry", async () => {
    timeout();
    await expect(run()).rejects.toThrow("EMAIL_UNCERTAIN");
    doc = withBooking({ status: "cancelled" });
    await run();
    expect(sent).toHaveLength(1);
  });
});

describe("live and simulated delivery", () => {
  it("never acknowledges a send that was meant to be real when the connection is not configured, and keeps trying", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    resolution = { live: false, reason: "missing-secret" };
    await expect(run()).rejects.toThrow("EMAIL_NOT_CONFIGURED");
    expect(sent).toHaveLength(0);
    expect(stored.live).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("missing-secret"));
    // The same row, claimed by a worker that does have the key, goes out for real.
    resolution = { live: true, reason: "live" };
    await run();
    expect(sent).toHaveLength(1);
    warn.mockRestore();
  });

  it("keeps an effect that was meant for a real send real, even where live is off", async () => {
    stored = { live: true, firstAttemptAt: T0 };
    resolution = { live: false, reason: "live-off" };
    await expect(run()).rejects.toThrow("EMAIL_NOT_CONFIGURED");
    expect(sent).toHaveLength(0);
  });

  it("simulates on purpose without an address or a token", async () => {
    resolution = { live: false, reason: "live-off" };
    await run();
    expect(stored.live).toBe(false);
    expect(sent[0].to).toEqual([`customer:${booking.customerId}`]);
    expect(sent[0].text).toContain("#t=simulated");
    expect(sent[0].text).not.toContain("v1.");
    expect(sent[0].html).not.toContain("v1.");
  });
});

describe("the rollout flags", () => {
  it("hold a public booking's message back while public booking is off, whichever flag", async () => {
    for (const flag of ["PUBLIC_BOOKING_LIVE", "OWNER_ACCOUNTS_ENABLED"]) {
      vi.stubEnv(flag, "");
      expect(await run()).toBe("deferred");
      vi.stubEnv(flag, "1");
    }
    expect(sent).toHaveLength(0);
    expect(stored).toEqual({});
  });

  it("do not hold an owner-made visit's message", async () => {
    vi.stubEnv("PUBLIC_BOOKING_LIVE", "");
    doc = withBooking({ publicRef: undefined, contactEmail: undefined }, profileEmail);
    await run();
    expect(sent).toHaveLength(1);
  });
});

describe("the public demo and an unconfigured server", () => {
  const outbox = () => createOutbox();

  it("never send for real without the live flags: the simulated adapter records a customer reference only", async () => {
    const fetch = vi.fn();
    const recorded = outbox();
    const sink = messageSink(prisma, createRegistry({ configFor: () => configFromEnv({}), outbox: recorded, fetch }), () => clock);
    await sink(delivery(), new AbortController().signal);
    expect(fetch).not.toHaveBeenCalled();
    expect(recorded.list("email")).toHaveLength(1);
    expect(recorded.list("email")[0].to).toBe(`customer:${booking.customerId}`);
    expect(JSON.stringify(recorded.list("email"))).not.toMatch(/lisa@example|v1\./);
  });

  it("ignore live flags and a key in the public demo", async () => {
    const fetch = vi.fn();
    const env = { CONCEPT_CONNECTIONS_LIVE: "1", CONCEPT_EMAIL_PROVIDER: "resend", RESEND_API_KEY: "synthetic-key", PUBLIC_READONLY: "1" };
    const real = createRegistry({ configFor: () => configFromEnv(env), secrets: { get: async (_b, name) => env[name as keyof typeof env], has: async () => true }, outbox: outbox(), fetch });
    expect(await real.resolve("email", TENANT)).toMatchObject({ live: false, reason: "public-demo" });
    await messageSink(prisma, real, () => clock)(delivery(), new AbortController().signal);
    expect(fetch).not.toHaveBeenCalled();
  });
});

function delivery(): EffectDelivery {
  return {
    id: "effect-1", tenantId: TENANT, tenantKind: "salon", seq: 1, n: 0,
    effect: { kind: "message", record: { id: "o-1", port: "email", action: "send", to: `customer:${booking.customerId}`, body: "x", cost: null, reference: messageReference(booking, "confirmation", "email") } },
  };
}
