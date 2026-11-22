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
/** Runs at the moment the provider is called, to see what was committed by then. */
let atSend: (() => void) | undefined;
const adapter = { info: { get provider() { return provider; } }, send: async (message: EmailMessage) => { atSend?.(); sent.push(message); return outcome; } } as unknown as EmailPort;
let resolution: { live: boolean; reason: ResolutionReason; account?: string };
const registry = { resolve: async () => ({ adapter, ...resolution }) };

let doc: DemoState | undefined;
/** What the effect row holds of the sink's bookkeeping, merged like the sink's UPDATE does. */
let stored: DeliveryState;
/** The row's own state, as the guarded writes see it. */
let row: { status: string; erased: boolean; attempts: number };
/** Runs when the sink reads the tenant under its lock, just before it commits `dispatched`: where an erasure can win. */
let beforeDispatch: (() => void) | undefined;
const sql = (strings: TemplateStringsArray) => strings.join("?");
const merge = (patch: Record<string, unknown>) => {
  const merged: Record<string, unknown> = { ...stored, ...patch };
  for (const key of Object.keys(merged)) if (merged[key] === null) delete merged[key];
  stored = merged as DeliveryState;
};
const open = (attempt: number) => row.status === "pending" && !row.erased && row.attempts === attempt;
// Interprets the few statements the sink makes, by their text.
const database = {
  $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = sql(strings);
    if (text.includes("FROM tenant_state")) {
      if (text.includes("FOR SHARE")) beforeDispatch?.();
      return doc ? [{ doc }] : [];
    }
    if (text.includes("set_config")) return [];
    if (text.includes("RETURNING payload->'delivery'")) {
      const [first, , attempt] = values as [string, string, number];
      if (!open(attempt)) return [];
      if (!("from" in stored)) merge(JSON.parse(first));
      return [{ delivery: structuredClone(stored) }];
    }
    if (text.includes("AS open")) return [{ open: row.status === "pending" && !row.erased }];
    throw new Error(`unexpected query: ${text}`);
  },
  $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = sql(strings);
    if (text.includes("jsonb_build_object('dispatched'")) {
      const [provider, account, , , attempt] = values as [string, string | undefined, string | undefined, string, number];
      if (!open(attempt)) return 0;
      merge({ dispatched: true, provider: stored.provider ?? provider, ...(stored.provider || !account ? {} : { account }) });
      return 1;
    }
    if (text.includes("status = 'delivered'")) {
      merge(JSON.parse(values[0] as string));
      row.status = "delivered";
      return 1;
    }
    // A write for the latest claim of a pending effect.
    const [patch, , attempt] = values as [string, string, number];
    if (!open(attempt)) return 0;
    merge(JSON.parse(patch));
    return 1;
  },
  $transaction: async (work: (tx: unknown) => unknown) => work(database),
};
const prisma = database as unknown as PrismaClient;

let clock = T0;
const run = (over: Partial<{ port: "email" | "sms"; reference: string; live: boolean }> = {}, signal = new AbortController().signal) => {
  const delivery: EffectDelivery = {
    id: "effect-1", tenantId: TENANT, tenantKind: "salon", seq: 1, n: 0, attempt: row.attempts,
    effect: { kind: "message", record: {
      id: "o-1", port: over.port ?? "email", action: "send", to: `customer:${booking.customerId}`, body: "x", cost: null, live: "live" in over ? over.live : true,
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
  row = { status: "pending", erased: false, attempts: 1 };
  beforeDispatch = undefined;
  atSend = undefined;
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
    expect(stored).toEqual({ sent: true, firstAttemptAt: T0 });
    expect(stored.mail).toBeUndefined();
  });

  it("puts a token for this booking in the link, made at delivery", async () => {
    await run();
    const token = /#t=(v1\.[^\s"]+)/.exec(sent[0].text)![1];
    expect(verifyBookingToken(token, { tenantId: TENANT, bookingId: "b-1", ref: REF, customerId: booking.customerId, purpose: "manage" }, Date.parse("2026-11-20T10:00:00Z"))).toBe(true);
    expect(sent[0].text).toContain(`/booking/${REF}#t=v1.${REF}.`);
    expect(sent[0].text).not.toContain("/booking/b-1");
  });

  it("describes each queued change as it was agreed: two moves and then a cancellation, drained after all three", async () => {
    // The booking now stands cancelled at its last slot; the effects were staged one per change, before any was delivered.
    doc = withBooking({ date: "2026-11-27", start: 720, status: "cancelled" });
    const at = (date: string, start: number, occasion: number, kind: "moved" | "cancellation") => messageReference({ ...booking, date, start }, kind, "email", occasion);
    const first = at("2026-11-25", 540, 3, "moved");
    const second = at("2026-11-27", 720, 5, "moved");
    const cancelled = at("2026-11-27", 720, 7, "cancellation");
    for (const reference of [first, second, cancelled]) {
      stored = {};
      row.status = "pending";
      expect(await run({ reference })).toBeUndefined();
    }
    expect(sent).toHaveLength(3);
    expect(sent[0].subject).toContain("25 Nov 2026 09:00");
    expect(sent[0].text).toContain("Your booking is moved to 25 Nov 2026 at 09:00");
    expect(sent[1].subject).toContain("27 Nov 2026 12:00");
    // A move's link is made for the move it describes, and a cancellation has none.
    const token = (text: string) => /#t=(v1\.[^\s"]+)/.exec(text)![1];
    expect(token(sent[0].text)).not.toBe(token(sent[1].text));
    expect(sent[2].text).toContain("Your booking is cancelled");
    expect(sent[2].text).not.toContain("#t=");
    // A confirmation for a cancelled booking is still skipped.
    sent.length = 0;
    stored = {};
    await run();
    expect(sent).toHaveLength(0);
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
    expect(await run()).toBe("skipped");
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
    expect(await run()).toBe("skipped");
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
    stored = { firstAttemptAt: T0, dispatched: true, provider: "resend", from: "f", mail: { subject: "s", text: "t", html: "h" } };
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
    expect(stored).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("missing-secret"));
    // The same row, claimed by a worker that does have the key, goes out for real.
    resolution = { live: true, reason: "live" };
    await run();
    expect(sent).toHaveLength(1);
    warn.mockRestore();
  });

  it("leaves a live row pending as a configuration error on a worker that resolves to the simulator, whichever the reason", async () => {
    for (const reason of ["live-off", "not-selected", "public-demo"] as const) {
      resolution = { live: false, reason };
      await expect(run({ live: true })).rejects.toThrow("EMAIL_NOT_CONFIGURED");
    }
    expect(sent).toHaveLength(0);
    expect(stored).toEqual({});
  });

  it("only ever simulates a row that is not live, even on a worker with the credentials", async () => {
    await run({ live: false });
    expect(sent).toHaveLength(0);
    expect(stored).toMatchObject({ sent: true });
    expect(stored.dispatched).toBeUndefined();
  });

  it("simulates on purpose without an address or a token", async () => {
    resolution = { live: false, reason: "live-off" };
    await run({ live: false });
    expect(sent[0].to).toEqual([`customer:${booking.customerId}`]);
    expect(sent[0].text).toContain("#t=simulated");
    expect(sent[0].text).not.toContain("v1.");
    expect(sent[0].html).not.toContain("v1.");
  });
});

describe("the dispatch", () => {
  const frozen = (over: DeliveryState = {}): DeliveryState => ({ firstAttemptAt: T0, from: "\"Salong\" <bookings@example.test>", mail: { subject: "s", text: "t", html: "h" }, ...over });

  it("commits `dispatched` before the provider is called, and clears it once the provider accepted", async () => {
    let seen: DeliveryState | undefined;
    atSend = () => { seen = structuredClone(stored); };
    await run();
    expect(seen).toMatchObject({ dispatched: true });
    expect(stored.dispatched).toBeUndefined();
  });

  it("sends nothing when an erasure cancelled the effect after the booking was read", async () => {
    beforeDispatch = () => { row = { ...row, status: "cancelled", erased: true }; };
    expect(await run()).toBe("failed");
    expect(sent).toHaveLength(0);
    expect(stored.dispatched).toBeUndefined();
  });

  it("sends nothing when an erasure cleared the address after the booking was read", async () => {
    beforeDispatch = () => { doc = withBooking({ contactEmail: undefined }); };
    expect(await run()).toBe("skipped");
    expect(sent).toHaveLength(0);
    expect(stored.dispatched).toBeUndefined();
  });

  it("writes nothing back to an effect that was erased before its first attempt froze the message", async () => {
    row = { ...row, status: "cancelled", erased: true };
    expect(await run()).toBe("failed");
    expect(sent).toHaveLength(0);
    expect(stored).toEqual({});
  });

  it("does not send for a claim another deliverer has replaced since, and leaves the row to that deliverer", async () => {
    beforeDispatch = () => { row.attempts = 2; };
    await expect(run()).rejects.toThrow("EMAIL_CLAIM_LOST");
    expect(sent).toHaveLength(0);
    expect(stored.dispatched).toBeUndefined();
  });

  it("keeps `dispatched` on a send that may have left, and fails it for reconciliation on Postmark without clearing it", async () => {
    provider = "postmark";
    outcome = fail(connectionError("email", "postmark", "timeout"));
    expect(await run()).toBe("failed");
    expect(stored).toMatchObject({ dispatched: true, reason: "uncertain" });
    // A crash before the failure was recorded on the row changes nothing: the next claim still does not send.
    expect(await run()).toBe("failed");
    expect(sent).toHaveLength(1);
  });

  it("retries a Resend in-progress conflict with the marker kept, only inside the window", async () => {
    outcome = fail(connectionError("email", "resend", "conflict", { providerCode: "concurrent_idempotent_requests" }));
    await expect(run()).rejects.toThrow("EMAIL_RETRYABLE");
    expect(stored.dispatched).toBe(true);
    clock = T0 + 22 * HOUR;
    outcome = ok({ id: "m-2", to: [] }, "sent");
    await run();
    expect(sent).toHaveLength(2);
    expect(sent[1].idempotencyKey).toBe(sent[0].idempotencyKey);
    // The same conflict past the window is not retried: someone reconciles it.
    stored = frozen({ dispatched: true, provider: "resend" });
    row.status = "pending";
    clock = T0 + 23 * HOUR + 1;
    expect(await run()).toBe("failed");
    expect(stored.reason).toBe("uncertain");
    expect(sent).toHaveLength(2);
  });

  it("repeats a request a crash left started on Resend within the window, under the same key", async () => {
    stored = frozen({ dispatched: true, provider: "resend" });
    clock = T0 + HOUR;
    await run();
    expect(sent).toHaveLength(1);
    expect(sent[0].idempotencyKey).toBe("effect-1");
    expect(stored).toEqual({ sent: true, firstAttemptAt: T0 });
  });

  it("clears the marker when a send that was never accepted is refused, but not one an earlier attempt may have sent", async () => {
    outcome = fail(connectionError("email", "resend", "rate_limited"));
    await expect(run()).rejects.toThrow("EMAIL_RETRYABLE");
    expect(stored.dispatched).toBeUndefined();
    stored = frozen({ dispatched: true, provider: "resend" });
    await expect(run()).rejects.toThrow("EMAIL_RETRYABLE");
    expect(stored.dispatched).toBe(true);
  });

  it("settles a permanent failure in one write, and a later claim does not send it again", async () => {
    outcome = fail(connectionError("email", "resend", "invalid_input"));
    expect(await run()).toBe("failed");
    expect(stored).toMatchObject({ reason: "invalid_input" });
    expect(stored.mail).toBeUndefined();
    expect(await run()).toBe("failed");
    expect(sent).toHaveLength(1);
  });
});

describe("claims, upgrades and providers", () => {
  const legacy = (over: DeliveryState = {}): DeliveryState => ({ firstAttemptAt: T0, mail: { subject: "Old subject 2026", text: "Old text __BOOKING_LINK__", html: "<p>Old __BOOKING_LINK__</p>" }, ...over });

  it("lets a stale deliverer neither clear nor settle what a newer claim wrote", async () => {
    outcome = fail(connectionError("email", "resend", "rate_limited"));
    // A is slow to clear its marker; B has claimed since and left its own request possibly sent.
    atSend = () => { row.attempts = 2; stored = { ...stored, dispatched: true, provider: "resend" }; };
    await expect(run()).rejects.toThrow("EMAIL_RETRYABLE");
    expect(stored.dispatched).toBe(true);
    stored = {};
    row.attempts = 1;
    outcome = fail(connectionError("email", "resend", "invalid_input"));
    expect(await run()).toBe("failed");
    expect(stored.reason).toBeUndefined();
  });

  it("keeps the first time and message of a row written before the sender was frozen, and does not send a dispatched one again", async () => {
    stored = legacy();
    clock = T0 + 5 * HOUR;
    await run();
    expect(sent[0]).toMatchObject({ subject: "Old subject 2026" });
    expect(stored.firstAttemptAt).toBe(T0);
    sent.length = 0;
    stored = legacy({ dispatched: true });
    row.status = "pending";
    clock = T0 + 30 * HOUR;
    expect(await run()).toBe("failed");
    expect(stored.reason).toBe("uncertain");
    expect(sent).toHaveLength(0);
  });

  it("keeps the intent a row was given before it was on the effect", async () => {
    stored = { live: true };
    resolution = { live: false, reason: "live-off" };
    await expect(run({ live: undefined })).rejects.toThrow("EMAIL_NOT_CONFIGURED");
    stored = { live: false };
    resolution = { live: true, reason: "live" };
    await run({ live: undefined });
    expect(sent).toHaveLength(0);
  });

  it("does not repeat a request that went to Postmark through Resend, or one with no recorded provider", async () => {
    for (const provider of ["postmark", undefined]) {
      stored = { firstAttemptAt: T0, dispatched: true, ...(provider ? { provider } : {}), from: "f", mail: { subject: "s", text: "t", html: "h" } };
      row.status = "pending";
      clock = T0 + HOUR;
      expect(await run()).toBe("failed");
      expect(stored.reason).toBe("uncertain");
    }
    expect(sent).toHaveLength(0);
  });

  it("repeats a Resend request only at the account it first went to", async () => {
    resolution = { live: true, reason: "live", account: "aaaaaaaaaaaa" };
    outcome = fail(connectionError("email", "resend", "timeout"));
    await expect(run()).rejects.toThrow("EMAIL_UNCERTAIN");
    expect(stored.account).toBe("aaaaaaaaaaaa");
    expect(JSON.stringify(stored)).not.toMatch(/secret/i);
    outcome = ok({ id: "m-2", to: [] }, "sent");
    resolution = { live: true, reason: "live", account: "bbbbbbbbbbbb" };
    clock = T0 + HOUR;
    expect(await run()).toBe("failed");
    expect(stored.reason).toBe("uncertain");
    expect(sent).toHaveLength(1);
    // The same account is repeated.
    stored = { firstAttemptAt: T0, dispatched: true, provider: "resend", account: "aaaaaaaaaaaa", from: "f", mail: { subject: "s", text: "t", html: "h" } };
    row.status = "pending";
    resolution = { live: true, reason: "live", account: "aaaaaaaaaaaa" };
    await run();
    expect(sent).toHaveLength(2);
  });

  it("records an acceptance as delivered even when the row was cancelled meanwhile", async () => {
    atSend = () => { row = { ...row, status: "cancelled", erased: true }; };
    await run();
    expect(row.status).toBe("delivered");
    expect(stored.sent).toBe(true);
  });
});

describe("a retry's payload", () => {
  it("keeps the link, sender and reply-to of the first attempt after the booking moves and the salon changes", async () => {
    doc = { ...withBooking(), salon: { ...base.salon, name: "Salong Fiktiv", email: "salong@example.test" } };
    outcome = fail(connectionError("email", "resend", "rate_limited"));
    await expect(run()).rejects.toThrow("EMAIL_RETRYABLE");
    expect(stored.link).toMatchObject({ url: expect.stringContaining(`/booking/${REF}`), exp: expect.any(Number) });
    // The stored link has no token, and the message nothing but the marker where it goes.
    expect(JSON.stringify(stored)).not.toMatch(/v1\.|#t=/);
    // The visit moves (the token's expiry would follow), the salon is renamed and changes its address.
    doc = { ...withBooking({ date: "2026-12-10", start: 840 }), salon: { ...base.salon, name: "Salong Omdöpt", email: "ny@example.test", slug: "omdopt" } };
    clock = T0 + HOUR;
    outcome = ok({ id: "m-2", to: [] }, "sent");
    await run();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ from: sent[0].from, replyTo: "salong@example.test", subject: sent[0].subject, text: sent[0].text, html: sent[0].html });
    expect(sent[1].from).toContain("Salong Fiktiv");
    expect(sent[1].text).toContain(`/boka/${base.salon.slug}/booking/${REF}#t=v1.`);
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
    id: "effect-1", tenantId: TENANT, tenantKind: "salon", seq: 1, n: 0, attempt: 1,
    effect: { kind: "message", record: { id: "o-1", port: "email", action: "send", to: `customer:${booking.customerId}`, body: "x", cost: null, live: false, reference: messageReference(booking, "confirmation", "email") } },
  };
}
