import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/waitlist/route";
import { createRateLimiter, EMAIL_MAX, joinWaitlist, parseWaitlistInput, RATE_LIMIT, waitlistProvider } from "@/concept/site/waitlist";
import { publicReadonlyResponse } from "@/lib/public-readonly";
import { site } from "@/concept/site/en";

describe("waiting list input", () => {
  it("accepts a plain address, trims and lower-cases it, and keeps a known business kind", () => {
    expect(parseWaitlistInput({ email: "  Anna@Example.COM ", business: "salon" })).toEqual({ ok: true, entry: { email: "anna@example.com", business: "salon" } });
    expect(parseWaitlistInput({ email: "a.b+c@sub.example.se" })).toEqual({ ok: true, entry: { email: "a.b+c@sub.example.se", business: undefined } });
    expect(parseWaitlistInput({ email: "a@b.se", business: "spaceship" })).toEqual({ ok: true, entry: { email: "a@b.se", business: undefined } });
  });

  it.each([null, undefined, "a@b.se", 42, {}, { email: 7 }, { email: "" }, { email: "anna" }, { email: "anna@" }, { email: "@example.com" }, { email: "anna@example" }, { email: "an na@example.com" }, { email: "anna@exa mple.com" }, { email: "anna@@example.com" }, { email: "anna@example..com" }, { email: "anna@-example.com" }, { email: "<anna@example.com>" }, { email: "a@b.se\nbcc: x@y.se" }])("refuses %j", (raw) => {
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
});

describe("POST /api/waitlist", () => {
  const post = (body: string, type = "application/json", ip = "203.0.113.1") =>
    POST(new Request("http://localhost/api/waitlist", { method: "POST", headers: { "content-type": type, "x-forwarded-for": ip }, body }));

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
