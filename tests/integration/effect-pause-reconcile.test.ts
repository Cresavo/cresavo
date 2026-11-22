import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/public/salons/[slug]/bookings/route";
import { addressProof } from "../../scripts/client-address.mjs";
import { acceptedTerms, type AcceptedTerms } from "../../src/concept/booking/public-terms";
import { connectionError, fail, ok, type PortResult } from "../../src/concept/connections/core";
import type { EmailMessage, EmailPort, EmailReceipt } from "../../src/concept/connections/ports/email";
import type { DeliveryState } from "../../src/concept/connections/simulated/outbox";
import { drainPendingEffects, SIMULATED_SINKS } from "../../src/concept/store/effect-outbox";
import { PostgresStudioStore } from "../../src/concept/store/postgres-studio-store";
import { db } from "../../src/lib/db";
import { listUnsettled, reconcileEffect } from "../../src/lib/effect-reconcile";
import { messageSink } from "../../src/lib/message-sink";
import { createOwnerAccount } from "../../src/lib/owner-accounts";
import { issuedAtToken } from "../../src/lib/public-issued-at";

// Pausing booking e-mail (CONCEPT_EMAIL_PAUSED=1) and the operator's reconcile
// tool, on a real database. The e-mail adapter only records: no provider exists
// and nothing is sent. The store's clock is fixed. All data is fictional.

const run = randomUUID().slice(0, 8);
const SECRET = "synthetic-address-secret";
const CLOCK = new Date("2026-11-16T10:00:00+01:00").getTime();
const HOUR = 3_600_000;
const DATE = "2026-11-26";

const holder = vi.hoisted(() => ({ store: undefined as unknown as import("../../src/concept/store/postgres-studio-store").PostgresStudioStore }));
vi.mock("../../src/lib/owner-store", async (importOriginal) => ({ ...(await importOriginal<object>()), ownerStore: () => holder.store }));

const mails: EmailMessage[] = [];
let outcome: PortResult<EmailReceipt>;
let provider = "resend";
/** False stands in for a worker whose connection is switched off (CONCEPT_CONNECTIONS_LIVE or the provider). */
let connected = true;
const adapter = { info: { get provider() { return provider; } }, send: async (m: EmailMessage) => (mails.push(m), outcome) } as unknown as EmailPort;
const registry = { resolve: async () => ({ adapter, live: connected, reason: connected ? "live" as const : "live-off" as const }) };
const sinks = { ...SIMULATED_SINKS, message: messageSink(db as unknown as PrismaClient, registry) };
const prisma = db as unknown as PrismaClient;

let tenantId = "";
let slug = "";
let serviceId = "";
let staffId = "";
let terms!: AcceptedTerms;
let calls = 0;

beforeAll(async () => {
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
  vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("BOOKING_ADDRESS_SECRET", SECRET);
  holder.store = new PostgresStudioStore({
    prisma, hmacSecret: randomBytes(32).toString("hex"), sinks, now: async () => CLOCK, maxAttempts: 2, liveMessage: () => true,
  });
  const account = await createOwnerAccount({ email: `${randomUUID().slice(0, 8)}-${run}@example.test`, password: "a long fictional passphrase", salonName: `Salong Paus ${run}`, language: "en" });
  if (!account.ok) throw new Error("sign-up failed");
  tenantId = account.tenantId;
  const { state } = (await holder.store.load(tenantId))!;
  slug = state.salon.slug;
  const added = await holder.store.apply(tenantId, {
    type: "service/add",
    service: { name: "Fictional pedicure", category: state.categories[0].id, duration: 30, price: 400, description: "Fictional", staffIds: [state.staff[0].id] },
  });
  if (!added.ok) throw new Error("service not added");
  serviceId = added.state.services[0].id;
  staffId = state.staff[0].id;
  terms = acceptedTerms(added.state, added.state.services[0]);
  await holder.store.apply(tenantId, { type: "salon/details", details: { email: "salon-paus@example.test" } });
});

beforeEach(() => {
  mails.length = 0;
  outcome = ok({ id: "m-1", to: [] }, "sent");
  provider = "resend";
  connected = true;
  vi.stubEnv("CONCEPT_EMAIL_PAUSED", "");
});

afterEach(async () => {
  await db.$executeRaw`UPDATE tenant_effect SET status = 'cancelled' WHERE tenant_id = ${tenantId} AND status IN ('pending', 'failed')`;
});

afterAll(async () => {
  await db.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  for (const table of ["tenant_effect", "tenant_idempotency", "tenant_action", "tenant_state"])
    await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id = $1`, tenantId);
  vi.unstubAllEnvs();
  await db.$disconnect();
});

async function book(start: number): Promise<string> {
  const ip = `10.9.${Math.floor(++calls / 250)}.${calls % 250}`;
  const body = {
    serviceId, staffId, date: DATE, start, name: "Lisa Berg", phone: `0735552${100 + calls}`, email: "lisa@example.test", language: "en", website: "",
    terms, issuedAt: issuedAtToken(tenantId, slug, Date.now() - 10_000),
  };
  const response = await POST(new NextRequest(`http://localhost/api/public/salons/${slug}/bookings`, {
    method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", host: "localhost", origin: "http://localhost", "idempotency-key": randomUUID(), "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET) },
  }), { params: Promise.resolve({ slug }) });
  expect(response.status).toBe(201);
  const [row] = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM tenant_effect WHERE tenant_id = ${tenantId} AND payload->>'port' = 'email' ORDER BY seq DESC LIMIT 1`;
  return row.id;
}

const effect = async (id: string) => (await db.$queryRaw<Array<{ status: string; attempts: number; delivery: DeliveryState | null }>>`
  SELECT status, attempts, payload->'delivery' AS delivery FROM tenant_effect WHERE id = ${id}`)[0];
const drain = (now: number) => drainPendingEffects({ prisma, sinks, tenants: [tenantId], now: async () => now, maxAttempts: 2 });
const act = (action: "retry" | "mark-sent" | "mark-failed", id: string, over: { tenantId?: string; apply?: boolean; force?: boolean } = {}) =>
  reconcileEffect(prisma, action, id, { tenantId: over.tenantId ?? tenantId, apply: over.apply ?? true, forceMaybeDuplicate: over.force });

describe("pausing booking e-mail", () => {
  it("claims nothing while paused, after the commit or in the poller, and counts no attempt however long it lasts", async () => {
    vi.stubEnv("CONCEPT_EMAIL_PAUSED", "1");
    // Down at the provider too: had anything been claimed, two attempts would fail it.
    outcome = fail(connectionError("email", "resend", "provider_unavailable"));
    connected = false;
    const id = await book(540);
    expect(await effect(id)).toMatchObject({ status: "pending", attempts: 0, delivery: null });
    // A payment of the same tenant is still delivered: only e-mail is held.
    await db.$executeRaw`
      INSERT INTO tenant_effect (tenant_id, seq, n, id, fingerprint, kind, payload, next_attempt_at)
      VALUES (${tenantId}, 9100001, 0, ${`pay-${run}`}, 'fingerprint', 'payment', ${JSON.stringify({ id: "o-pay", port: "payments", action: "checkout", body: "Fictional deposit", cost: null })}::jsonb, to_timestamp(0))`;
    expect(await drain(CLOCK)).toEqual({ delivered: 1, retried: 0, failed: 0 });
    for (let hour = 1; hour <= 30; hour++) expect(await drain(CLOCK + hour * HOUR)).toEqual({ delivered: 0, retried: 0, failed: 0 });
    expect(await effect(id)).toMatchObject({ status: "pending", attempts: 0 });
    expect(mails).toHaveLength(0);

    vi.stubEnv("CONCEPT_EMAIL_PAUSED", "");
    outcome = ok({ id: "m-2", to: [] }, "sent");
    connected = true;
    expect(await drain(CLOCK + 31 * HOUR)).toEqual({ delivered: 1, retried: 0, failed: 0 });
    expect(await effect(id)).toMatchObject({ status: "delivered", attempts: 1 });
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: ["lisa@example.test"], idempotencyKey: id });
  });

  it("keeps a row that already used an attempt one short of failing until delivery resumes", async () => {
    outcome = fail(connectionError("email", "resend", "rate_limited"));
    const id = await book(600);
    // The commit's own drain used one of the two attempts.
    expect(await effect(id)).toMatchObject({ status: "pending", attempts: 1, delivery: { lastError: "EMAIL_RETRYABLE" } });
    vi.stubEnv("CONCEPT_EMAIL_PAUSED", "1");
    for (let hour = 1; hour <= 5; hour++) await drain(CLOCK + hour * HOUR);
    expect(await effect(id)).toMatchObject({ status: "pending", attempts: 1 });
    vi.stubEnv("CONCEPT_EMAIL_PAUSED", "");
    outcome = ok({ id: "m-3", to: [] }, "sent");
    expect(await drain(CLOCK + 6 * HOUR)).toEqual({ delivered: 1, retried: 0, failed: 0 });
    expect(await effect(id)).toMatchObject({ status: "delivered", attempts: 2 });
    expect(mails.map((m) => m.idempotencyKey)).toEqual([id, id]);
  });
});

describe("reconciling the e-mail outbox", () => {
  it("retries a row that failed while the connection was off, once, after a dry run that changes nothing", async () => {
    connected = false;
    const id = await book(660);
    await drain(CLOCK + HOUR);
    expect(await effect(id)).toMatchObject({ status: "failed", attempts: 2, delivery: { lastError: "EMAIL_NOT_CONFIGURED" } });
    expect(mails).toHaveLength(0);
    const listed = (await listUnsettled(prisma, { tenantId, limit: 50 })).find((row) => row.id === id);
    expect(listed).toMatchObject({ tenantId, kind: "email/confirmation", state: "failed", attempts: 2, error: "EMAIL_NOT_CONFIGURED", dispatched: false, recipient: "***@example.test" });
    expect(listed!.ageMs).toBeGreaterThan(0);

    expect(await act("retry", id, { apply: false })).toEqual({ effectId: id, outcome: "change" });
    expect(await effect(id)).toMatchObject({ status: "failed", attempts: 2 });
    expect(await act("retry", id)).toEqual({ effectId: id, outcome: "change" });
    expect(await effect(id)).toMatchObject({ status: "pending", attempts: 0, delivery: { reconciled: "retried" } });
    expect((await effect(id)).delivery).not.toHaveProperty("lastError");
    expect(await act("retry", id)).toEqual({ effectId: id, outcome: "unchanged", reason: "pending" });

    connected = true;
    expect(await drain(CLOCK + 2 * HOUR)).toEqual({ delivered: 1, retried: 0, failed: 0 });
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: ["lisa@example.test"], idempotencyKey: id });
    expect(await act("retry", id)).toEqual({ effectId: id, outcome: "unchanged", reason: "delivered" });
  });

  it("resends what the first attempt froze: the same message, link, sender and reply-to", async () => {
    outcome = fail(connectionError("email", "resend", "rate_limited"));
    const id = await book(720);
    await drain(CLOCK + HOUR);
    const before = await effect(id);
    expect(before).toMatchObject({ status: "failed", delivery: { from: expect.stringContaining("Salong Paus"), replyTo: "salon-paus@example.test", link: expect.anything(), mail: expect.anything() } });
    const first = mails[0];
    // The salon changes its name and address afterwards: a resend must not pick that up.
    await holder.store.apply(tenantId, { type: "salon/details", details: { name: `Ny Salong ${run}`, email: "ny-salong@example.test" } });

    expect(await act("retry", id)).toMatchObject({ outcome: "change" });
    const { delivery } = await effect(id);
    for (const key of ["firstAttemptAt", "mail", "link", "from", "replyTo"] as const) expect(delivery![key]).toEqual(before.delivery![key]);
    outcome = ok({ id: "m-4", to: [] }, "sent");
    expect(await drain(CLOCK + 2 * HOUR)).toEqual({ delivered: 1, retried: 0, failed: 0 });
    const resent = mails.at(-1)!;
    expect(resent).toMatchObject({ from: first.from, replyTo: "salon-paus@example.test", subject: first.subject, text: first.text, idempotencyKey: id });
    expect(resent.from).not.toContain("Ny Salong");
    await holder.store.apply(tenantId, { type: "salon/details", details: { name: `Salong Paus ${run}`, email: "salon-paus@example.test" } });
  });

  it("settles an uncertain row as sent, refusing a retry without force and another tenant's id", async () => {
    provider = "postmark";
    outcome = fail(connectionError("email", "postmark", "timeout"));
    const id = await book(780);
    expect(await effect(id)).toMatchObject({ status: "failed", delivery: { reason: "uncertain", dispatched: true } });
    expect((await listUnsettled(prisma, { tenantId, limit: 50 })).find((row) => row.id === id)).toMatchObject({ state: "uncertain", error: "uncertain", dispatched: true });

    expect(await act("retry", id)).toEqual({ effectId: id, outcome: "refused", reason: "dispatched" });
    expect(await act("mark-sent", id, { tenantId: `other-${run}` })).toEqual({ effectId: id, outcome: "refused", reason: "tenant_mismatch" });
    expect(await effect(id)).toMatchObject({ status: "failed", delivery: { reason: "uncertain" } });

    expect(await act("mark-sent", id)).toEqual({ effectId: id, outcome: "change" });
    expect(await effect(id)).toMatchObject({ status: "delivered", delivery: { sent: true, reconciled: "sent" } });
    expect((await effect(id)).delivery).not.toHaveProperty("dispatched");
    expect(await act("mark-sent", id)).toEqual({ effectId: id, outcome: "unchanged", reason: "delivered" });
    expect(await act("mark-failed", id)).toEqual({ effectId: id, outcome: "refused", reason: "delivered" });
    await drain(CLOCK + 2 * HOUR);
    expect(mails).toHaveLength(1);
  });

  it("settles an uncertain row as not sent, and resends it only when forced", async () => {
    provider = "postmark";
    outcome = fail(connectionError("email", "postmark", "network"));
    const id = await book(840);
    expect(await act("mark-failed", id)).toEqual({ effectId: id, outcome: "change" });
    expect(await effect(id)).toMatchObject({ status: "failed", delivery: { reason: "not_sent", reconciled: "not_sent", dispatched: true } });
    expect(await act("mark-failed", id)).toEqual({ effectId: id, outcome: "unchanged", reason: "not_sent" });
    expect(await act("mark-sent", id)).toEqual({ effectId: id, outcome: "refused", reason: "not_uncertain" });
    expect(await act("retry", id)).toEqual({ effectId: id, outcome: "refused", reason: "dispatched" });
    expect(await act("retry", id, { tenantId: `other-${run}`, force: true })).toEqual({ effectId: id, outcome: "refused", reason: "tenant_mismatch" });

    expect(await act("retry", id, { force: true })).toEqual({ effectId: id, outcome: "change" });
    const reopened = await effect(id);
    expect(reopened).toMatchObject({ status: "pending", attempts: 0 });
    expect(reopened.delivery).not.toHaveProperty("dispatched");
    expect(reopened.delivery).not.toHaveProperty("reason");
    provider = "resend";
    outcome = ok({ id: "m-5", to: [] }, "sent");
    expect(await drain(CLOCK + 2 * HOUR)).toEqual({ delivered: 1, retried: 0, failed: 0 });
    expect(mails).toHaveLength(2);
    expect(mails[1]).toMatchObject({ to: ["lisa@example.test"], idempotencyKey: id });
  });

  it("refuses an id that does not exist, and changes nothing on a dry run of a mark", async () => {
    expect(await act("retry", `missing-${run}`)).toEqual({ effectId: `missing-${run}`, outcome: "refused", reason: "not_found" });
    provider = "postmark";
    outcome = fail(connectionError("email", "postmark", "timeout"));
    const id = await book(900);
    expect(await act("mark-sent", id, { apply: false })).toEqual({ effectId: id, outcome: "change" });
    expect(await effect(id)).toMatchObject({ status: "failed", delivery: { reason: "uncertain" } });
  });

  it("runs as a command: lists with the recipient's domain only, and a dry run logs one line per id", async () => {
    connected = false;
    const id = await book(960);
    await drain(CLOCK + HOUR);
    const exec = promisify(execFile);
    const cli = (...args: string[]) => exec(process.execPath, ["--import", "tsx", "scripts/reconcile-effects.mts", ...args], { env: process.env, timeout: 60_000 });
    const { stdout: listed } = await cli("list", "--tenant", tenantId);
    expect(listed).toContain(`tenant ${tenantId}`);
    expect(listed).toMatch(new RegExp(`${id}  email/confirmation  failed  age \\S+  attempts 2  error EMAIL_NOT_CONFIGURED  not-dispatched  to \\*\\*\\*@example\\.test`));
    expect(listed).not.toMatch(/lisa@|Lisa|Fictional/);

    const { stdout, stderr } = await cli("retry", id, "--tenant", tenantId, "--actor", "ops-test");
    expect(JSON.parse(stdout.trim())).toMatchObject({ event: "effect_reconcile", actor: "ops-test", action: "retry", tenantId, effectId: id, dryRun: true, outcome: "change" });
    expect(stderr).toContain("Dry run");
    expect(await effect(id)).toMatchObject({ status: "failed", attempts: 2 });

    const refused = await cli("retry", id, "--tenant", `other-${run}`, "--apply").catch((error: { code: number; stdout: string }) => error);
    expect(refused).toMatchObject({ code: 1 });
    expect(JSON.parse((refused as { stdout: string }).stdout.trim())).toMatchObject({ outcome: "refused", reason: "tenant_mismatch", dryRun: false });
    expect(await effect(id)).toMatchObject({ status: "failed", attempts: 2 });
  });
});
