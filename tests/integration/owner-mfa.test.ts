import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "../../src/concept/connections/core";
import type { EmailMessage } from "../../src/concept/connections/ports/email";
import { db } from "../../src/lib/db";
import { createOwnerAccount, verifyOwnerCredentials } from "../../src/lib/owner-accounts";
import { OWNER_MFA_PENDING_COOKIE } from "../../src/lib/owner-mfa-pending";
import { requestPasswordReset, resetPassword, type ResetRegistry } from "../../src/lib/owner-password-reset";
import { openOwnerSession, OWNER_COOKIE, ownerFromCookie } from "../../src/lib/owner-session";
import { hotp, totpStep } from "../../src/lib/owner-totp";
import { POST as loginRoute } from "../../src/app/api/owner/login/route";
import { POST as mfaLoginRoute } from "../../src/app/api/owner/login/mfa/route";
import { POST as setupRoute } from "../../src/app/api/owner/mfa/setup/route";
import { POST as enableRoute } from "../../src/app/api/owner/mfa/enable/route";
import { POST as disableRoute } from "../../src/app/api/owner/mfa/disable/route";
import { POST as recoveryRoute } from "../../src/app/api/owner/mfa/recovery-codes/route";
import { GET as meRoute } from "../../src/app/api/owner/me/route";
import { GET as salonRoute } from "../../src/app/api/owner/salon/route";
import { POST as actionsRoute } from "../../src/app/api/owner/salon/actions/route";
import { POST as signupRoute } from "../../src/app/api/owner/signup/route";

// Owner two-step sign-in against a disposable local *_test database, through the routes. All data is fictional.
// Date is faked so codes can be taken from a known step; the shared lock store reads the database clock, which
// lock-outs here never need to move.

vi.mock("../../src/lib/rate-limit", async (original) => ({
  ...(await original<typeof import("../../src/lib/rate-limit")>()),
  clientIp: (headers: Headers) => headers.get("x-forwarded-for") ?? "127.0.0.1",
}));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (task: () => unknown) => void task() }));

const run = randomUUID().slice(0, 8);
const email = (name: string) => `mfa-${name}-${run}@example.test`;
const password = "a long fictional passphrase";
const START = Date.UTC(2026, 10, 22, 10, 0, 0);
const origin = "http://localhost";
const MFA_KEY = randomBytes(32).toString("base64");
let ipCounter = 0;
let testIndex = 0;
/** A fresh client address, so the per-address sign-in limit of one test never reaches another. */
const freshIp = () => `198.18.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

const later = (ms: number) => vi.setSystemTime(Date.now() + ms);
const nextStep = () => later(30_000);

function post(path: string, body: unknown, { ip = freshIp(), cookies = {} as Record<string, string | undefined> } = {}) {
  const cookie = Object.entries(cookies).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("; ");
  return new NextRequest(`${origin}${path}`, {
    method: "POST", body: JSON.stringify(body),
    headers: { origin, host: "localhost", "content-type": "application/json", "x-forwarded-for": ip, ...(cookie ? { cookie } : {}) },
  });
}
const get = (path: string, session?: string) =>
  new NextRequest(`${origin}${path}`, { headers: { host: "localhost", ...(session ? { cookie: `${OWNER_COOKIE}=${session}` } : {}) } });

const setCookie = (response: Response, name: string) => response.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
const cookieValue = (response: Response, name: string) => setCookie(response, name)?.split(";")[0].slice(name.length + 1) || undefined;
const answer = async (response: Response) => ({ status: response.status, body: await response.json() });

function fromBase32(text: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const char of text) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
const codeNow = (secret: Buffer) => hotp(secret, totpStep(Date.now()));

async function account(name: string) {
  const result = await createOwnerAccount({ email: email(name), password, salonName: `Salong ${name}`, language: "en" });
  if (!result.ok) throw new Error("sign-up failed");
  const session = await openOwnerSession(result.identity);
  return { ...result, session: session!.value };
}

/** An account with two-step sign-in on: its secret, recovery codes and the session the enable re-issued. */
async function enrolled(name: string) {
  const a = await account(name);
  const setup = await setupRoute(post("/api/owner/mfa/setup", { password }, { cookies: { [OWNER_COOKIE]: a.session } }));
  expect(setup.status).toBe(200);
  const { secret, otpauthUri } = await setup.json();
  expect(otpauthUri).toContain(`secret=${secret}`);
  const key = fromBase32(secret);
  const enable = await enableRoute(post("/api/owner/mfa/enable", { password, code: codeNow(key) }, { cookies: { [OWNER_COOKIE]: a.session } }));
  expect(enable.status).toBe(200);
  const { recoveryCodes } = await enable.json();
  const session = cookieValue(enable, OWNER_COOKIE)!;
  nextStep(); // the enable used this step's code
  return { ...a, key, recoveryCodes: recoveryCodes as string[], session, firstSession: a.session };
}

/** The password step: the response and the pending cookie it set. */
async function passwordStep(name: string, ip = freshIp()) {
  const response = await loginRoute(post("/api/owner/login", { email: email(name), password }, { ip }));
  return { response, pending: cookieValue(response, OWNER_MFA_PENDING_COOKIE) };
}

const secondStep = (pending: string | undefined, body: unknown, ip = freshIp()) =>
  mfaLoginRoute(post("/api/owner/login/mfa", body, { ip, cookies: { [OWNER_MFA_PENDING_COOKIE]: pending } }));

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("OWNER_MFA_KEY", MFA_KEY);
  vi.stubEnv("NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN", "book.example");
  vi.setSystemTime(START + ++testIndex * 3_600_000);
});

afterAll(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  const accounts = await db.ownerAccount.findMany({ where: { email: { endsWith: `-${run}@example.test` } }, select: { tenantId: true } });
  await db.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  await db.tenantState.deleteMany({ where: { tenantId: { in: accounts.map((a) => a.tenantId) } } });
  await db.$disconnect();
});

describe("setting up two-step sign-in", () => {
  it("turns it on with a code, and sign-in then asks for one before any session", async () => {
    const a = await enrolled("happy");
    expect(a.recoveryCodes).toHaveLength(10);
    expect(await answer(await meRoute(get("/api/owner/me", a.session)))).toEqual({ status: 200, body: { email: email("happy"), mfaEnabled: true } });

    const { response, pending } = await passwordStep("happy");
    expect(await answer(response)).toEqual({ status: 200, body: { next: "mfa" } });
    expect(setCookie(response, OWNER_COOKIE)).toBeUndefined();
    const attributes = setCookie(response, OWNER_MFA_PENDING_COOKIE)!;
    for (const part of [/HttpOnly/i, /SameSite=strict/i, /Path=\/api\/owner\/login(;|$)/, /Max-Age=300/]) expect(attributes).toMatch(part);
    expect(attributes).not.toMatch(/Secure/i);

    const signedIn = await secondStep(pending, { code: codeNow(a.key) });
    expect(signedIn.status).toBe(200);
    const session = cookieValue(signedIn, OWNER_COOKIE);
    expect((await ownerFromCookie(session))?.tenantId).toBe(a.tenantId);
    expect(setCookie(signedIn, OWNER_MFA_PENDING_COOKIE)).toMatch(/Max-Age=0/);
  });

  it("stores the secret encrypted and the recovery codes hashed", async () => {
    const a = await enrolled("stored");
    const row = await db.ownerAccount.findUniqueOrThrow({ where: { id: a.identity.id } });
    expect(row.totpSecretEnc).toMatch(/^v1:/);
    expect(row.totpPendingEnc).toBeNull();
    expect(row.totpEnabledAt).not.toBeNull();
    const hashes = await db.ownerRecoveryCode.findMany({ where: { accountId: a.identity.id } });
    expect(hashes).toHaveLength(10);
    for (const code of a.recoveryCodes) expect(hashes.some((h) => h.codeHash.includes(code.replace("-", "")))).toBe(false);
  });

  it("needs the current password and a right first code, and expires an unconfirmed setup after ten minutes", async () => {
    const a = await account("setup-checks");
    const cookies = { [OWNER_COOKIE]: a.session };
    expect(await answer(await setupRoute(post("/api/owner/mfa/setup", { password: "not the password" }, { cookies })))).toEqual({ status: 403, body: { error: "wrong_password" } });
    expect((await setupRoute(post("/api/owner/mfa/setup", { password }))).status).toBe(401);
    const { secret } = await (await setupRoute(post("/api/owner/mfa/setup", { password }, { cookies }))).json();
    const key = fromBase32(secret);
    const wrong = String((Number(codeNow(key)) + 1) % 1_000_000).padStart(6, "0");
    expect(await answer(await enableRoute(post("/api/owner/mfa/enable", { password, code: wrong }, { cookies })))).toEqual({ status: 400, body: { error: "invalid_code" } });
    expect((await enableRoute(post("/api/owner/mfa/enable", { password: "not the password", code: codeNow(key) }, { cookies }))).status).toBe(403);
    later(10 * 60_000 + 1000);
    expect(await answer(await enableRoute(post("/api/owner/mfa/enable", { password, code: codeNow(key) }, { cookies })))).toEqual({ status: 409, body: { error: "setup_expired" } });
    expect((await db.ownerAccount.findUniqueOrThrow({ where: { id: a.identity.id } })).totpEnabledAt).toBeNull();
  });

  it("ends every other session on enable and keeps this device signed in", async () => {
    const a = await account("enable-sessions");
    const other = (await openOwnerSession(a.identity))!.value;
    const cookies = { [OWNER_COOKIE]: a.session };
    const { secret } = await (await setupRoute(post("/api/owner/mfa/setup", { password }, { cookies }))).json();
    const enable = await enableRoute(post("/api/owner/mfa/enable", { password, code: codeNow(fromBase32(secret)) }, { cookies }));
    const renewed = cookieValue(enable, OWNER_COOKIE);
    expect(await ownerFromCookie(other)).toBeNull();
    expect(await ownerFromCookie(a.session)).toBeNull();
    expect((await ownerFromCookie(renewed))?.mfaEnabled).toBe(true);
    expect(await answer(await setupRoute(post("/api/owner/mfa/setup", { password }, { cookies: { [OWNER_COOKIE]: renewed } }))))
      .toEqual({ status: 409, body: { error: "already_enabled" } });
  });
});

describe("the second step", () => {
  it("refuses the same code twice", async () => {
    const a = await enrolled("replay");
    const code = codeNow(a.key);
    const first = await passwordStep("replay");
    expect((await secondStep(first.pending, { code })).status).toBe(200);
    const second = await passwordStep("replay");
    expect(await answer(await secondStep(second.pending, { code }))).toEqual({ status: 401, body: { error: "invalid_code" } });
    // An earlier step's code is refused too, once a later one was used.
    later(-30_000);
    const third = await passwordStep("replay");
    expect(await answer(await secondStep(third.pending, { code: codeNow(a.key) }))).toEqual({ status: 401, body: { error: "invalid_code" } });
  });

  it("lets exactly one of two simultaneous uses of one code through", async () => {
    const a = await enrolled("parallel");
    const [one, two] = [await passwordStep("parallel"), await passwordStep("parallel")];
    const code = codeNow(a.key);
    const results = await Promise.all([secondStep(one.pending, { code }), secondStep(two.pending, { code })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it("locks the address after five wrong codes, and the password alone does not reset the count", async () => {
    const a = await enrolled("lock");
    const wrong = { code: String((Number(codeNow(a.key)) + 7) % 1_000_000).padStart(6, "0") };
    let step = await passwordStep("lock");
    for (let n = 0; n < 3; n++) expect((await secondStep(step.pending, wrong)).status).toBe(401);
    // Signing in with the password again keeps the three failures.
    step = await passwordStep("lock");
    expect(step.pending).toBeTruthy();
    for (let n = 0; n < 2; n++) expect((await secondStep(step.pending, wrong)).status).toBe(401);
    // Locked: the right code and the right password are both refused, with the generic answers.
    expect(await answer(await secondStep(step.pending, { code: codeNow(a.key) }))).toEqual({ status: 401, body: { error: "invalid_code" } });
    expect(await answer((await passwordStep("lock")).response)).toEqual({ status: 401, body: { error: "invalid_credentials" } });
    expect(await verifyOwnerCredentials({ email: email("lock"), password })).toBeNull();
  });

  it("accepts a recovery code once", async () => {
    const a = await enrolled("recovery");
    const [code] = a.recoveryCodes;
    const first = await passwordStep("recovery");
    expect((await secondStep(first.pending, { recoveryCode: code.toUpperCase() })).status).toBe(200);
    const second = await passwordStep("recovery");
    expect(await answer(await secondStep(second.pending, { recoveryCode: code }))).toEqual({ status: 401, body: { error: "invalid_code" } });
    expect((await secondStep(second.pending, { recoveryCode: a.recoveryCodes[1] })).status).toBe(200);
    expect(await db.ownerRecoveryCode.count({ where: { accountId: a.identity.id, usedAt: { not: null } } })).toBe(2);
  });

  it("refuses a pending cookie from before a credential change, a forged one and none", async () => {
    const a = await enrolled("stale");
    const { pending } = await passwordStep("stale");
    await db.ownerAccount.update({ where: { id: a.identity.id }, data: { credentialVersion: { increment: 1 } } });
    const stale = await secondStep(pending, { code: codeNow(a.key) });
    expect(await answer(stale)).toEqual({ status: 401, body: { error: "mfa_expired" } });
    expect(setCookie(stale, OWNER_MFA_PENDING_COOKIE)).toMatch(/Max-Age=0/);
    expect((await secondStep(undefined, { code: codeNow(a.key) })).status).toBe(401);
    const forged = `${pending!.slice(0, -1)}${pending!.endsWith("0") ? "1" : "0"}`;
    expect((await secondStep(forged, { code: codeNow(a.key) })).status).toBe(401);
    later(5 * 60_000 + 1000);
    const fresh = await passwordStep("stale");
    later(5 * 60_000 + 1000);
    expect(await answer(await secondStep(fresh.pending, { code: codeNow(a.key) }))).toEqual({ status: 401, body: { error: "mfa_expired" } });
  });

  it("refuses a deactivated account", async () => {
    const a = await enrolled("inactive");
    const { pending } = await passwordStep("inactive");
    await db.ownerAccount.update({ where: { id: a.identity.id }, data: { active: false } });
    expect(await answer(await secondStep(pending, { code: codeNow(a.key) }))).toEqual({ status: 401, body: { error: "invalid_code" } });
    expect(await answer(await secondStep(pending, { recoveryCode: a.recoveryCodes[0] }))).toEqual({ status: 401, body: { error: "invalid_code" } });
  });

  it("never opens one salon with another's pending cookie or codes", async () => {
    const a = await enrolled("tenant-a");
    const b = await enrolled("tenant-b");
    const pendingA = (await passwordStep("tenant-a")).pending;
    expect((await secondStep(pendingA, { code: codeNow(b.key) })).status).toBe(401);
    expect((await secondStep(pendingA, { recoveryCode: b.recoveryCodes[0] })).status).toBe(401);
    expect(await db.ownerRecoveryCode.count({ where: { accountId: b.identity.id, usedAt: { not: null } } })).toBe(0);
    const pendingB = (await passwordStep("tenant-b")).pending;
    const intoB = await secondStep(pendingB, { code: codeNow(b.key) });
    expect((await ownerFromCookie(cookieValue(intoB, OWNER_COOKIE)))?.tenantId).toBe(b.tenantId);
    expect(b.tenantId).not.toBe(a.tenantId);
    // A's session cannot change B's two-step sign-in: the routes act on the session's own account.
    const disabled = await disableRoute(post("/api/owner/mfa/disable", { password, code: codeNow(b.key) }, { cookies: { [OWNER_COOKIE]: a.session } }));
    expect(disabled.status).toBe(400);
    expect((await db.ownerAccount.findUniqueOrThrow({ where: { id: b.identity.id } })).totpEnabledAt).not.toBeNull();
  });
});

describe("without OWNER_MFA_KEY", () => {
  it("answers 503 and never skips the second step", async () => {
    const a = await enrolled("no-key");
    const plain = await account("no-key-plain");
    vi.stubEnv("OWNER_MFA_KEY", "");
    const login = await passwordStep("no-key");
    expect(await answer(login.response)).toEqual({ status: 503, body: { error: "not_configured" } });
    expect(setCookie(login.response, OWNER_COOKIE)).toBeUndefined();
    expect(login.pending).toBeUndefined();
    expect(await answer(await setupRoute(post("/api/owner/mfa/setup", { password }, { cookies: { [OWNER_COOKIE]: plain.session } }))))
      .toEqual({ status: 503, body: { error: "not_configured" } });
    vi.stubEnv("OWNER_MFA_KEY", MFA_KEY);
    const { pending } = await passwordStep("no-key");
    vi.stubEnv("OWNER_MFA_KEY", "");
    const step = await secondStep(pending, { code: codeNow(a.key) });
    expect(await answer(step)).toEqual({ status: 503, body: { error: "not_configured" } });
    expect(setCookie(step, OWNER_COOKIE)).toBeUndefined();
    // Accounts without two-step sign-in still sign in.
    expect((await loginRoute(post("/api/owner/login", { email: email("no-key-plain"), password }))).status).toBe(200);
  });

  it("answers 503 for a secret another key wrote, without counting a failure", async () => {
    const a = await enrolled("rotated");
    vi.stubEnv("OWNER_MFA_KEY", randomBytes(32).toString("base64"));
    for (let n = 0; n < 6; n++) {
      const { pending } = await passwordStep("rotated");
      expect((await secondStep(pending, { code: codeNow(a.key) })).status).toBe(503);
    }
    vi.stubEnv("OWNER_MFA_KEY", MFA_KEY);
    const { pending } = await passwordStep("rotated");
    expect((await secondStep(pending, { code: codeNow(a.key) })).status).toBe(200);
  });
});

describe("managing two-step sign-in", () => {
  it("regenerates the recovery codes and the old ones stop working", async () => {
    const a = await enrolled("regen");
    const cookies = { [OWNER_COOKIE]: a.session };
    expect((await recoveryRoute(post("/api/owner/mfa/recovery-codes", { password, code: "000000" }, { cookies }))).status).toBe(400);
    const response = await recoveryRoute(post("/api/owner/mfa/recovery-codes", { password, code: codeNow(a.key) }, { cookies }));
    expect(response.status).toBe(200);
    const { recoveryCodes } = await response.json();
    expect(recoveryCodes).toHaveLength(10);
    expect(recoveryCodes).not.toContain(a.recoveryCodes[0]);
    const { pending } = await passwordStep("regen");
    expect((await secondStep(pending, { recoveryCode: a.recoveryCodes[0] })).status).toBe(401);
    expect((await secondStep(pending, { recoveryCode: recoveryCodes[0] })).status).toBe(200);
    // The session stays as it was.
    expect(await ownerFromCookie(a.session)).not.toBeNull();
  });

  it("turns off with a code, deletes the codes and ends other sessions", async () => {
    const a = await enrolled("disable");
    const other = (await openOwnerSession({ id: a.identity.id, credentialVersion: a.identity.credentialVersion + 1 }))!.value;
    const cookies = { [OWNER_COOKIE]: a.session };
    expect((await disableRoute(post("/api/owner/mfa/disable", { password: "not the password", code: codeNow(a.key) }, { cookies }))).status).toBe(403);
    const response = await disableRoute(post("/api/owner/mfa/disable", { password, code: codeNow(a.key) }, { cookies }));
    expect(response.status).toBe(200);
    const renewed = cookieValue(response, OWNER_COOKIE);
    expect(await ownerFromCookie(other)).toBeNull();
    expect(await ownerFromCookie(a.session)).toBeNull();
    expect((await ownerFromCookie(renewed))?.mfaEnabled).toBe(false);
    expect(await db.ownerRecoveryCode.count({ where: { accountId: a.identity.id } })).toBe(0);
    const row = await db.ownerAccount.findUniqueOrThrow({ where: { id: a.identity.id } });
    expect([row.totpSecretEnc, row.totpPendingEnc, row.totpEnabledAt, row.totpLastStep]).toEqual([null, null, null, null]);
    const login = await loginRoute(post("/api/owner/login", { email: email("disable"), password }));
    expect(await answer(login)).toEqual({ status: 200, body: { ok: true } });
  });

  it("turns off with a recovery code", async () => {
    const a = await enrolled("disable-recovery");
    const response = await disableRoute(post("/api/owner/mfa/disable", { password, recoveryCode: a.recoveryCodes[3] }, { cookies: { [OWNER_COOKIE]: a.session } }));
    expect(response.status).toBe(200);
    expect((await db.ownerAccount.findUniqueOrThrow({ where: { id: a.identity.id } })).totpEnabledAt).toBeNull();
  });

  it("keeps two-step sign-in after a password reset", async () => {
    const a = await enrolled("reset");
    const sent: EmailMessage[] = [];
    const registry: ResetRegistry = {
      resolve: async () => ({
        live: true, reason: "live",
        adapter: {
          info: { port: "email", provider: "postmark", kind: "simulated", capabilities: ["send"], secrets: [] },
          send: async (message) => { sent.push(message); return ok({ id: "m-1", to: message.to }, "queued"); },
        },
      }),
    };
    await requestPasswordReset({ email: email("reset") }, registry, Date.now());
    const token = /#t=([^\s"<]+)/.exec(sent[0].text)![1];
    const newPassword = "another fictional passphrase";
    expect(await resetPassword({ token, password: newPassword }, Date.now())).toEqual({ ok: true });
    expect(await ownerFromCookie(a.session)).toBeNull();
    const response = await loginRoute(post("/api/owner/login", { email: email("reset"), password: newPassword }));
    expect(await answer(response)).toEqual({ status: 200, body: { next: "mfa" } });
    expect((await secondStep(cookieValue(response, OWNER_MFA_PENDING_COOKIE), { code: codeNow(a.key) })).status).toBe(200);
  });
});

describe("OWNER_MFA_REQUIRED=1", () => {
  it("limits a session without two-step sign-in to setting it up", async () => {
    vi.stubEnv("OWNER_MFA_REQUIRED", "1");
    const signup = await signupRoute(post("/api/owner/signup", { email: email("required"), password, salonName: "Salong Required", language: "en" }));
    expect(signup.status).toBe(200);
    const session = cookieValue(signup, OWNER_COOKIE)!;
    const cookies = { [OWNER_COOKIE]: session };
    expect(await answer(await salonRoute(get("/api/owner/salon", session)))).toEqual({ status: 403, body: { error: "mfa_required" } });
    const action = await actionsRoute(post("/api/owner/salon/actions", { action: { type: "salon/update" }, idempotencyKey: "k".repeat(32) }, { cookies }));
    expect(await answer(action)).toEqual({ status: 403, body: { error: "mfa_required" } });
    expect(await answer(await meRoute(get("/api/owner/me", session)))).toEqual({ status: 200, body: { email: email("required"), mfaEnabled: false } });

    const { secret } = await (await setupRoute(post("/api/owner/mfa/setup", { password }, { cookies }))).json();
    const enable = await enableRoute(post("/api/owner/mfa/enable", { password, code: codeNow(fromBase32(secret)) }, { cookies }));
    expect(enable.status).toBe(200);
    const full = cookieValue(enable, OWNER_COOKIE)!;
    expect((await salonRoute(get("/api/owner/salon", full))).status).toBe(200);
  });

  it("is off by default", async () => {
    const a = await account("not-required");
    expect((await salonRoute(get("/api/owner/salon", a.session))).status).toBe(200);
  });
});
