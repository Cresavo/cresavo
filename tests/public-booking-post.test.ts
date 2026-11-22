import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/public/salons/[slug]/bookings/route";
import { GET } from "@/app/api/public/salons/[slug]/route";
import { MAX_BOOKING_BODY_BYTES, publicBookingSchema } from "@/lib/public-booking-request";
import { issuedAtToken, issuedAtValid, MAX_FORM_MS, MIN_FORM_MS } from "@/lib/public-issued-at";
import type { DemoAction } from "@/concept/actions";
import { acceptedTerms } from "@/concept/booking/public-terms";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";
import { addressProof } from "../scripts/client-address.mjs";

// The public booking write: validation, bot friction, rate limits and the
// mapping of every store result. The database and the store are stubs.
// Fictional data and a fixed clock only.

const NOW = new Date("2026-11-16T10:00:00+01:00");
const SECRET = "synthetic-address-secret";
const SLUG = "salong-fiktiv";
let TENANT = "";

const query = vi.hoisted(() => vi.fn());
const apply = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { $queryRaw: query } }));
vi.mock("@/lib/owner-store", () => ({ ownerStore: () => ({ apply }) }));

const base = createDemoState("2026-11-16");
const doc = (over: Record<string, unknown> = {}) => ({ ...base, salon: { ...base.salon, slug: SLUG }, ...over });
const service = base.services.find((s) => s.id === "medical-foot-care")!;
const terms = acceptedTerms(base, service);
const date = "2026-11-24";
const [start] = freeStarts(base, "anna", date, { serviceId: service.id, duration: service.duration }, { step: 30 });

const form = (over: Record<string, unknown> = {}) => ({
  serviceId: service.id, staffId: "anna", date, start, name: "Lisa Berg", phone: "073-555 01 02", email: "lisa@example.test", language: "en",
  website: "", terms, issuedAt: issuedAtToken(TENANT, SLUG, NOW.getTime() - 10_000), ...over,
});

let counter = 0;
function post(body: unknown, { ip = `10.1.${Math.floor(counter / 250)}.${counter % 250}`, headers = {}, slug = SLUG, key = `key-${++counter}` }: { ip?: string; headers?: Record<string, string>; slug?: string; key?: string | null } = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return POST(new NextRequest(`http://localhost/api/public/salons/${slug}/bookings`, {
    method: "POST", body: raw,
    headers: {
      "content-type": "application/json", host: "localhost", origin: "http://localhost",
      "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET),
      ...(key === null ? {} : { "idempotency-key": key }), ...headers,
    },
  }), { params: Promise.resolve({ slug }) });
}

const committed = (replayed = false) => ({
  ok: true, replayed, version: 2, effects: [], entry: {},
  state: { ...base, bookings: [...base.bookings, { id: "b-17", publicRef: "ref-fictional", customerId: "k-new", staffId: "anna", serviceId: service.id, date, start, duration: service.duration, price: service.price, status: "booked", source: "online" }] },
});

const live = () => {
  vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
};

beforeEach(() => {
  // The rate limits live in this process; each test is a salon of its own.
  TENANT = `tenant-fiktiv-${++counter}`;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("BOOKING_ADDRESS_SECRET", SECRET);
  vi.stubEnv("SESSION_SECRET", "synthetic-session-secret-of-32-chars!!");
  live();
  query.mockReset().mockImplementation(async () => [{ tenant_id: TENANT, doc: doc() }]);
  // Like the store: a new commit takes the salon's allowance under its lock, so it can be refused with 429.
  apply.mockReset().mockImplementation(async (_tenant: string, _action: unknown, _meta: unknown, options?: { beforeCommit?: () => Promise<void> }) => (await options?.beforeCommit?.(), committed()));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("the booking request schema", () => {
  const ok = (over: Record<string, unknown> = {}) => publicBookingSchema.safeParse(form(over)).success;

  it("accepts a well-formed request", () => {
    expect(ok()).toBe(true);
  });

  it("requires the terms the guest saw, whole", () => {
    expect(ok({ terms: undefined })).toBe(false);
    expect(ok({ terms: { ...terms, currency: undefined } })).toBe(false);
    expect(ok({ terms: { ...terms, extra: 1 } })).toBe(false);
  });

  it("holds every field to its limit", () => {
    expect(ok({ name: " A " })).toBe(false);
    expect(ok({ name: "  Li  " })).toBe(true);
    expect(ok({ name: "x".repeat(81) })).toBe(false);
    expect(ok({ phone: "123" })).toBe(false);
    expect(ok({ phone: "+46 70 123 45 67 89 01 23" })).toBe(false);
    expect(ok({ email: "not-an-address" })).toBe(false);
    expect(ok({ email: `${"a".repeat(250)}@example.test` })).toBe(false);
    expect(ok({ serviceId: "s".repeat(65) })).toBe(false);
    expect(ok({ staffId: "" })).toBe(false);
    expect(ok({ date: "2026-02-30" })).toBe(false);
    expect(ok({ date: "2026-1-5" })).toBe(false);
    expect(ok({ start: -1 })).toBe(false);
    expect(ok({ start: 1440 })).toBe(false);
    expect(ok({ start: 600.5 })).toBe(false);
    expect(ok({ language: "de" })).toBe(false);
  });

  it("keeps display controls out of the name, and lets ordinary Unicode and right-to-left names through", () => {
    for (const bad of ["Li\u0000sa", "Lisa\nBerg", "Li‮sa Berg", "Lisa ⁦Berg", "Lisa\u0085Berg"]) expect(ok({ name: bad })).toBe(false);
    for (const good of ["Åsa Öberg", "李小龍", "محمد علي", "יוסי כהן", "Zoë O’Neil-Müller"]) expect(ok({ name: good })).toBe(true);
  });

  it("refuses a filled honeypot and any field it does not know", () => {
    expect(ok({ website: "https://spam.example" })).toBe(false);
    expect(ok({ note: "free text" })).toBe(false);
  });
});

describe("the form-time token", () => {
  const issued = NOW.getTime();

  it("is valid between the minimum and maximum age, for its own salon and address only", () => {
    const token = issuedAtToken("tenant-a", SLUG, issued);
    expect(issuedAtValid(token, "tenant-a", SLUG, issued + MIN_FORM_MS)).toBe(true);
    expect(issuedAtValid(token, "tenant-a", SLUG, issued + MAX_FORM_MS)).toBe(true);
    expect(issuedAtValid(token, "tenant-a", "annan-salong", issued + MIN_FORM_MS)).toBe(false);
  });

  it("does not work for another salon that has taken over the address", () => {
    const token = issuedAtToken("tenant-a", SLUG, issued);
    expect(issuedAtValid(token, "tenant-b", SLUG, issued + MIN_FORM_MS)).toBe(false);
  });

  it("is refused when too young or expired", () => {
    const token = issuedAtToken("tenant-a", SLUG, issued);
    expect(issuedAtValid(token, "tenant-a", SLUG, issued + MIN_FORM_MS - 1)).toBe(false);
    expect(issuedAtValid(token, "tenant-a", SLUG, issued + MAX_FORM_MS + 1)).toBe(false);
  });

  it("is refused when tampered with, forged, malformed or signed with another secret", () => {
    const [, mac] = issuedAtToken("tenant-a", SLUG, issued).split(".");
    const later = issued + 60_000;
    expect(issuedAtValid(`${issued - 1000}.${mac}`, "tenant-a", SLUG, later)).toBe(false);
    expect(issuedAtValid(`${issued}.${"0".repeat(64)}`, "tenant-a", SLUG, later)).toBe(false);
    expect(issuedAtValid(`${issued}.${mac.slice(1)}`, "tenant-a", SLUG, later)).toBe(false);
    for (const bad of ["", "x", `${issued}`, `${issued}.`, "abc.def"]) expect(issuedAtValid(bad, "tenant-a", SLUG, later)).toBe(false);
    vi.stubEnv("SESSION_SECRET", "another-synthetic-session-secret-32!");
    const foreign = issuedAtToken("tenant-a", SLUG, issued);
    vi.stubEnv("SESSION_SECRET", "synthetic-session-secret-of-32-chars!!");
    expect(issuedAtValid(foreign, "tenant-a", SLUG, later)).toBe(false);
  });

  it("is handed out by the read route, bound to the salon it resolved", async () => {
    const response = await GET(new NextRequest(`http://localhost/api/public/salons/${SLUG}`, {
      headers: { "x-booking-client-ip": "192.0.2.8", "x-booking-client-proof": addressProof("192.0.2.8", SECRET) },
    }), { params: Promise.resolve({ slug: SLUG.toUpperCase() }) });
    const { issuedAt } = await response.json();
    expect(issuedAtValid(issuedAt, TENANT, SLUG, NOW.getTime() + 5000)).toBe(true);
    expect(issuedAtValid(issuedAt, "another-tenant", SLUG, NOW.getTime() + 5000)).toBe(false);
  });
});

describe("POST /api/public/salons/[slug]/bookings", () => {
  it("books through the store with the guest's intent, and answers only an opaque reference and what was booked", async () => {
    const response = await post(form(), { key: "a-key" });
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ ref: "ref-fictional", serviceId: service.id, staffId: "anna", date, start, duration: service.duration });
    const [tenant, action, meta, options] = apply.mock.calls[0] as [string, Extract<DemoAction, { type: "online/book" }>, unknown, { idempotencyKey: string; expectedVersion?: number; beforeCommit?: unknown }];
    expect(tenant).toBe(TENANT);
    expect(action).toMatchObject({ type: "online/book", serviceId: service.id, staffId: "anna", date, start, guest: { name: "Lisa Berg", phone: "073-555 01 02", email: "lisa@example.test" }, public: { slug: SLUG, terms } });
    expect(action.public?.publicRef).toMatch(/^[0-9a-f-]{36}$/);
    // The notice is the reducer's to write, from the salon's own data, so it is not part of what is fingerprinted.
    expect(action).not.toHaveProperty("notice");
    expect(meta).toEqual({ actor: "customer", source: "customer-page" });
    expect(options).toEqual({ idempotencyKey: "booking-page:a-key", beforeCommit: expect.any(Function) });
  });

  it("never returns the store's state or the internal booking id", async () => {
    const text = await (await post(form())).text();
    expect(text).not.toContain("customers");
    expect(text).not.toContain(TENANT);
    expect(text).not.toContain("b-17");
  });

  it("maps a busy store to 503 with Retry-After", async () => {
    apply.mockResolvedValue({ ok: false, reason: "conflict" });
    const response = await post(form());
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("1");
  });

  it("maps a reused key with another request to 422", async () => {
    apply.mockResolvedValue({ ok: false, reason: "idempotency-mismatch" });
    const response = await post(form());
    expect([response.status, await response.json()]).toEqual([422, { error: "idempotency_mismatch" }]);
  });

  it("maps a missing tenant to 404, from the store or from the address", async () => {
    apply.mockResolvedValue({ ok: false, reason: "not-found" });
    expect((await post(form())).status).toBe(404);
    query.mockResolvedValue([]);
    expect((await post(form())).status).toBe(404);
  });

  it("answers an internal failure with a code only", async () => {
    apply.mockRejectedValue(new Error("connection string with secrets"));
    const response = await post(form());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secrets");
  });

  describe("when the reducer refuses", () => {
    const refused = () => apply.mockResolvedValue({ ok: false, reason: "rejected" });

    it("says slot_unavailable when the salon's terms are as the guest saw them", async () => {
      refused();
      const response = await post(form());
      expect([response.status, await response.json()]).toEqual([409, { error: "slot_unavailable" }]);
    });

    it("says terms_changed when the price, length or policy moved, and hands the terms to the store to judge", async () => {
      refused();
      const dearer = doc({ services: base.services.map((s) => (s.id === service.id ? { ...s, price: s.price + 100 } : s)) });
      query.mockImplementation(async () => [{ tenant_id: TENANT, doc: dearer }]);
      const response = await post(form());
      expect([response.status, await response.json()]).toEqual([409, { error: "terms_changed" }]);
      expect(apply).toHaveBeenCalledTimes(1);
    });

    it("says deposit_unsupported for a deposit, the same for every guest whether or not the phone is a known customer", async () => {
      refused();
      const withDeposit = doc({ cancellationPolicy: { ...base.cancellationPolicy, deposits: { [service.id]: 20000 }, newCustomersOnly: true } });
      query.mockImplementation(async () => [{ tenant_id: TENANT, doc: withDeposit }]);
      const deposit = acceptedTerms(withDeposit as never, service);
      const answers = await Promise.all([base.customers[0].phone, "073-412 34 56"].map(async (phone) => {
        const response = await post(form({ phone, terms: deposit }));
        return [response.status, await response.json()];
      }));
      expect(answers).toEqual([[409, { error: "deposit_unsupported" }], [409, { error: "deposit_unsupported" }]]);
    });
  });

  it("answers every refusal of the request the same way, the honeypot's and a bad token's included", async () => {
    const refusals = [
      form({ website: "https://spam.example" }),
      form({ issuedAt: issuedAtToken(TENANT, SLUG, NOW.getTime() - 1000) }),
      form({ issuedAt: issuedAtToken(TENANT, SLUG, NOW.getTime() - MAX_FORM_MS - 1000) }),
      form({ issuedAt: issuedAtToken("a-former-owner-of-the-address", SLUG, NOW.getTime() - 10_000) }),
      form({ issuedAt: "forged" }),
      form({ email: "nope" }),
      { ...form(), extra: 1 },
      "not json",
    ];
    const answers = await Promise.all(refusals.map(async (body, i) => {
      const response = await post(body, { ip: `192.0.2.${100 + i}` });
      return [response.status, await response.text()];
    }));
    expect(new Set(answers.map((a) => JSON.stringify(a)))).toEqual(new Set([JSON.stringify([422, JSON.stringify({ error: "invalid" })])]));
    expect(apply).not.toHaveBeenCalled();
  });

  it("requires an Idempotency-Key of the allowed form", async () => {
    expect((await post(form(), { key: null })).status).toBe(422);
    expect((await post(form(), { key: "no spaces allowed" })).status).toBe(422);
    expect((await post(form(), { key: "k".repeat(65) })).status).toBe(422);
    expect(apply).not.toHaveBeenCalled();
  });

  it("refuses a body over 4 KB with 413, by length and while streaming", async () => {
    const big = form({ name: "x".repeat(MAX_BOOKING_BODY_BYTES) });
    expect((await post(big)).status).toBe(413);
    const chunk = new TextEncoder().encode("x".repeat(MAX_BOOKING_BODY_BYTES));
    const stream = new ReadableStream({ start(controller) { controller.enqueue(chunk); controller.enqueue(chunk); controller.close(); } });
    const streamed = await POST(new NextRequest(`http://localhost/api/public/salons/${SLUG}/bookings`, {
      method: "POST", body: stream, duplex: "half",
      headers: { host: "localhost", origin: "http://localhost", "idempotency-key": "k-stream", "x-booking-client-ip": "192.0.2.50", "x-booking-client-proof": addressProof("192.0.2.50", SECRET) },
    } as ConstructorParameters<typeof NextRequest>[1]), { params: Promise.resolve({ slug: SLUG }) });
    expect(streamed.status).toBe(413);
    expect(apply).not.toHaveBeenCalled();
  });

  it("refuses a write that does not come from the site's own pages", async () => {
    expect((await post(form(), { headers: { origin: "https://evil.example" } })).status).toBe(403);
    expect((await post(form(), { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(apply).not.toHaveBeenCalled();
  });

  it("is forbidden in read-only mode and absent while the flag is off", async () => {
    vi.stubEnv("PUBLIC_READONLY", "1");
    expect((await post(form())).status).toBe(403);
    vi.stubEnv("PUBLIC_READONLY", "");
    vi.stubEnv("PUBLIC_BOOKING_LIVE", "");
    expect((await post(form())).status).toBe(404);
    expect(apply).not.toHaveBeenCalled();
  });

  it("limits one address to 10 attempts in 15 minutes, well-formed or not", async () => {
    const ip = "192.0.2.77";
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await post(i % 2 ? "not json" : form(), { ip })).status);
    expect(statuses.slice(0, 10)).toEqual([201, 422, 201, 422, 201, 422, 201, 422, 201, 422]);
    expect(statuses[10]).toBe(429);
    expect((await post(form(), { ip: "192.0.2.78" })).status).toBe(201);
  });

  describe("the salon's allowance of 60 new bookings an hour", () => {
    const fromEverywhere = (i: number) => ({ ip: `198.51.${Math.floor(i / 5)}.${i % 5}` });

    it("is charged once per new booking, and no new attempt is taken once it is used", async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 62; i++) statuses.push((await post(form(), fromEverywhere(i))).status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(60);
      expect(statuses.slice(60)).toEqual([429, 429]);
      // A retry the store recognises is answered with its receipt even now.
      apply.mockResolvedValueOnce(committed(true));
      expect((await post(form(), { ip: "203.0.113.9" })).status).toBe(201);
      vi.setSystemTime(new Date(NOW.getTime() + 16 * 60_000));
      expect((await post(form({ issuedAt: issuedAtToken(TENANT, SLUG, NOW.getTime()) }), { ip: "203.0.113.1" })).status).toBe(429);
      vi.setSystemTime(new Date(NOW.getTime() + 61 * 60_000));
      expect((await post(form({ issuedAt: issuedAtToken(TENANT, SLUG, NOW.getTime()) }), { ip: "203.0.113.2" })).status).toBe(201);
    });

    it("is not spent by refusals or by a retry of a booking already made", async () => {
      apply.mockResolvedValue({ ok: false, reason: "rejected" });
      for (let i = 0; i < 70; i++) expect((await post(form(), fromEverywhere(i))).status).toBe(409);
      apply.mockResolvedValue(committed(true));
      for (let i = 70; i < 140; i++) expect((await post(form(), fromEverywhere(i))).status).toBe(201);
      apply.mockResolvedValue(committed());
      expect((await post(form(), fromEverywhere(141))).status).toBe(201);
    });
  });
});
