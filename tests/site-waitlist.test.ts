import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/waitlist/route";
import { createRateLimiter, EMAIL_MAX, joinWaitlist, parseWaitlistInput, RATE_LIMIT, waitlistProvider } from "@/concept/site/waitlist";
import { readCapped, UNVERIFIED_CLIENT, waitlistClientKey } from "@/concept/site/waitlist-server";
import { addressProof } from "../scripts/client-address.mjs";
import { publicReadonlyResponse } from "@/lib/public-readonly";
import { site } from "@/concept/site/en";

describe("waiting list input", () => {
  it("accepts a plain address, trims and lower-cases it, and keeps a known business kind", () => {
    expect(parseWaitlistInput({ email: "  Anna@Example.COM ", business: "salon" })).toEqual({ ok: true, entry: { email: "anna@example.com", business: "salon" } });
    expect(parseWaitlistInput({ email: "a.b+c@sub.example.se" })).toEqual({ ok: true, entry: { email: "a.b+c@sub.example.se", business: undefined } });
    expect(parseWaitlistInput({ email: "a@b.example", business: "spaceship" })).toEqual({ ok: true, entry: { email: "a@b.example", business: undefined } });
  });

  it.each([null, undefined, "a@b.example", 42, {}, { email: 7 }, { email: "" }, { email: "anna" }, { email: "anna@" }, { email: "@example.com" }, { email: "anna@example" }, { email: "an na@example.com" }, { email: "anna@exa mple.com" }, { email: "anna@@example.com" }, { email: "anna@example..com" }, { email: "anna@-example.com" }, { email: "<anna@example.com>" }, { email: "a@b.example\nbcc: x@y.example" }])("refuses %j", (raw) => {
    expect(parseWaitlistInput(raw)).toEqual({ ok: false, reason: "invalid" });
  });

  it("caps the length", () => {
    const local = "a".repeat(EMAIL_MAX - "@example.com".length);
    expect(parseWaitlistInput({ email: `${local}@example.com` }).ok).toBe(true);
    expect(parseWaitlistInput({ email: `a${local}@example.com` })).toEqual({ ok: false, reason: "invalid" });
  });

  it("treats a filled honeypot as a bot, whatever the address", () => {
    expect(parseWaitlistInput({ email: "anna@example.com", website: "https://spam.example" })).toEqual({ ok: false, reason: "bot" });
    expect(parseWaitlistInput({ email: "anna@example.com", website: "  " }).ok).toBe(true);
  });
});

describe("waiting list provider", () => {
  it("is none unless a known provider is named", () => {
    expect(waitlistProvider({})).toBe("none");
    expect(waitlistProvider({ WAITLIST_PROVIDER: "" })).toBe("none");
    expect(waitlistProvider({ WAITLIST_PROVIDER: "mailchimp" })).toBe("none");
    expect(waitlistProvider({ WAITLIST_PROVIDER: " Buttondown " })).toBe("buttondown");
  });

  it("none stores nothing and never claims the address was added", async () => {
    expect(await joinWaitlist({ email: "anna@example.com" }, "none")).toBe("not-open");
    expect(site["waitlist.outcome.not-open"]).toBe("Thanks! The list opens in a few days. Come back soon.");
    expect(site["waitlist.outcome.not-open"]).not.toMatch(/added|on the list|subscribed|we'll email/i);
  });

  it("a provider that is named but not built yet behaves like none", async () => {
    for (const provider of ["resend", "buttondown", "loops", "postgres"] as const) expect(await joinWaitlist({ email: "anna@example.com" }, provider)).toBe("not-open");
  });
});

describe("waiting list rate limit", () => {
  it("allows a few tries per client and window, then refuses until the window ends", () => {
    const allowed = createRateLimiter({ max: 2, windowMs: 1000 });
    expect([allowed("a", 0), allowed("a", 10), allowed("a", 20)]).toEqual([true, true, false]);
    expect(allowed("b", 20)).toBe(true);
    expect(allowed("a", 1001)).toBe(true);
  });

  it("at capacity drops the oldest window, not every counter", () => {
    const allowed = createRateLimiter({ max: 1, windowMs: 1000 }, 2);
    expect([allowed("a", 0), allowed("b", 0), allowed("a", 1), allowed("b", 1)]).toEqual([true, true, false, false]);
    expect(allowed("c", 2)).toBe(true);
    // "a" was the oldest and is gone; "b" is still counted.
    expect(allowed("b", 3)).toBe(false);
    expect(allowed("a", 3)).toBe(true);
  });
});

describe("waiting list client key", () => {
  const secret = "a".repeat(64);
  const signed = (ip: string, extra: Record<string, string> = {}) => new Headers({ "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, secret), ...extra });

  it("uses the address the server wrapper signed and ignores X-Forwarded-For", () => {
    const env = { BOOKING_ADDRESS_SECRET: secret };
    expect(waitlistClientKey(signed("203.0.113.9", { "x-forwarded-for": "198.51.100.1" }), env)).toBe("203.0.113.9");
    expect(waitlistClientKey(signed("203.0.113.9", { "x-forwarded-for": "198.51.100.2" }), env)).toBe("203.0.113.9");
  });

  it("puts every unverified request in one shared bucket, however its headers vary", () => {
    const env = { BOOKING_ADDRESS_SECRET: secret };
    expect(waitlistClientKey(new Headers({ "x-forwarded-for": "198.51.100.1" }), env)).toBe(UNVERIFIED_CLIENT);
    expect(waitlistClientKey(new Headers({ "x-booking-client-ip": "198.51.100.3", "x-booking-client-proof": "0".repeat(64) }), env)).toBe(UNVERIFIED_CLIENT);
    expect(waitlistClientKey(signed("203.0.113.9"), {})).toBe(UNVERIFIED_CLIENT);
  });

  it("on Vercel reads only the platform's x-real-ip", () => {
    const env = { BOOKING_RUNTIME: "vercel", VERCEL: "1" };
    expect(waitlistClientKey(new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }), env)).toBe("203.0.113.7");
    expect(waitlistClientKey(new Headers({ "x-forwarded-for": "198.51.100.1" }), env)).toBe(UNVERIFIED_CLIENT);
  });
});

describe("waiting list body cap", () => {
  const stream = (chunks: string[]) => {
    const pulled: number[] = [];
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const next = chunks[pulled.length];
        pulled.push(pulled.length);
        if (next === undefined) controller.close();
        else controller.enqueue(new TextEncoder().encode(next));
      },
    });
    return { body, pulled };
  };

  it("stops reading as soon as the cap is passed", async () => {
    const { body, pulled } = stream(["a".repeat(8), "b".repeat(8), "c".repeat(8), "d".repeat(8)]);
    const request = new Request("http://localhost/api/waitlist", { method: "POST", body, duplex: "half" } as RequestInit);
    expect(await readCapped(request, 10)).toBe("too-large");
    expect(pulled.length).toBeLessThan(4);
  });

  it("refuses a declared length over the cap without reading", async () => {
    const request = new Request("http://localhost/api/waitlist", { method: "POST", body: "x", headers: { "content-length": "5000" } });
    expect(await readCapped(request, 10)).toBe("too-large");
    expect(request.bodyUsed).toBe(false);
  });

  it("returns the text when it fits, counting bytes not characters", async () => {
    expect(await readCapped(new Request("http://localhost/", { method: "POST", body: "åäö" }), 6)).toBe("åäö");
    expect(await readCapped(new Request("http://localhost/", { method: "POST", body: "åäöx" }), 6)).toBe("too-large");
  });
});

describe("POST /api/waitlist", () => {
  const secret = "b".repeat(64);
  const previous = process.env.BOOKING_ADDRESS_SECRET;
  beforeAll(() => { process.env.BOOKING_ADDRESS_SECRET = secret; });
  afterAll(() => { process.env.BOOKING_ADDRESS_SECRET = previous; });
  const headers = (type: string, ip: string) => ({ "content-type": type, "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, secret) });
  const post = (body: BodyInit, type = "application/json", ip = "203.0.113.1") =>
    POST(new Request("http://localhost/api/waitlist", { method: "POST", headers: headers(type, ip), body, duplex: "half" } as RequestInit));

  it("answers honestly with the default provider", async () => {
    const response = await post(JSON.stringify({ email: "anna@example.com", business: "salon" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "not-open" });
  });

  it("refuses a bad address and broken JSON", async () => {
    expect((await post(JSON.stringify({ email: "nope" }), undefined, "203.0.113.2")).status).toBe(400);
    expect(await (await post("{", undefined, "203.0.113.2")).json()).toEqual({ outcome: "invalid" });
  });

  it("gives a bot the same quiet answer", async () => {
    expect(await (await post(JSON.stringify({ email: "anna@example.com", website: "x" }), undefined, "203.0.113.3")).json()).toEqual({ outcome: "not-open" });
  });

  it("sends a form post without JavaScript back to the page it came from", async () => {
    const response = await post("email=anna%40example.com&from=%2Fcoming-soon", "application/x-www-form-urlencoded", "203.0.113.4");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/coming-soon?waitlist=not-open#waitlist");
    const elsewhere = await post("email=anna%40example.com&from=https%3A%2F%2Fevil.example", "application/x-www-form-urlencoded", "203.0.113.4");
    expect(elsewhere.headers.get("location")).toBe("http://localhost/?waitlist=not-open#waitlist");
  });

  it("limits repeated tries from one address", async () => {
    const statuses: number[] = [];
    for (let i = 0; i <= RATE_LIMIT.max; i++) statuses.push((await post(JSON.stringify({ email: "anna@example.com" }), undefined, "203.0.113.5")).status);
    expect(statuses.slice(0, RATE_LIMIT.max).every((status) => status === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it("does not give a fresh bucket for a changed X-Forwarded-For", async () => {
    const statuses: number[] = [];
    for (let i = 0; i <= RATE_LIMIT.max; i++) {
      const request = new Request("http://localhost/api/waitlist", { method: "POST", headers: { ...headers("application/json", "203.0.113.6"), "x-forwarded-for": `198.51.100.${i}` }, body: JSON.stringify({ email: "anna@example.com" }) });
      statuses.push((await POST(request)).status);
    }
    expect(statuses.at(-1)).toBe(429);
  });

  it("refuses a limited client before reading the body", async () => {
    for (let i = 0; i < RATE_LIMIT.max; i++) await post(JSON.stringify({ email: "anna@example.com" }), undefined, "203.0.113.7");
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({ pull(controller) { pulled++; controller.enqueue(new TextEncoder().encode("{}")); controller.close(); } });
    expect((await post(body, undefined, "203.0.113.7")).status).toBe(429);
    expect(pulled).toBe(0);
  });

  it("answers 413 to an oversized body, even when the fields up front are valid", async () => {
    const big = `email=anna%40example.com&from=%2F&pad=${"x".repeat(3000)}`;
    const response = await post(big, "application/x-www-form-urlencoded", "203.0.113.8");
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ outcome: "invalid" });
  });

  it("stays reachable on the read-only public demo", () => {
    const env = process.env.PUBLIC_READONLY;
    process.env.PUBLIC_READONLY = "1";
    try {
      expect(publicReadonlyResponse(new Request("http://localhost/api/waitlist", { method: "POST" }))).toBeUndefined();
      expect(publicReadonlyResponse(new Request("http://localhost/api/concept/ai", { method: "POST" }))?.status).toBe(403);
    } finally {
      process.env.PUBLIC_READONLY = env;
    }
  });
});
