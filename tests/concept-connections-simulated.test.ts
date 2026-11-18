import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reduce } from "@/concept/actions";
import { bookingMessage } from "@/concept/booking/messages";
import { isE164, isUtc, majorString, moneyFromMajor, isTimeZone, PORTS } from "@/concept/connections/core";
import { demoOutbox } from "@/concept/connections/demo";
import { dailySalesVoucher, isBalanced } from "@/concept/connections/ports/accounting";
import { smsSegments } from "@/concept/connections/ports/sms";
import { simulatedAdapters, simulatedSms } from "@/concept/connections/simulated/adapters";
import { createOutbox } from "@/concept/connections/simulated/outbox";
import { createDemoState } from "@/concept/data/generate";
import type { Channel } from "@/concept/data/types";

const today = "2026-11-16";
const state = createDemoState(today);
const at = { date: today, time: 540 };

beforeEach(() => {
  demoOutbox.clear();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("simulated adapters must not fetch"); }));
});
afterEach(() => vi.unstubAllGlobals());

describe("shared contract helpers", () => {
  it("validates locale-neutral fields", () => {
    expect(isE164("+46701234567")).toBe(true);
    expect(isE164("070-123 45 67")).toBe(false);
    expect(isUtc("2026-11-18T09:30:00Z")).toBe(true);
    expect(isUtc("2026-11-18T09:30:00+01:00")).toBe(false);
    expect(isTimeZone("Europe/Stockholm")).toBe(true);
    expect(isTimeZone("Mars/Base")).toBe(false);
  });

  it("converts provider major-unit amounts to minor units, rounding costs up", () => {
    expect(moneyFromMajor("-0.0646", "usd")).toEqual({ amountMinor: 7, currency: "USD" });
    expect(moneyFromMajor(12.5, "SEK")).toEqual({ amountMinor: 1250, currency: "SEK" });
    expect(moneyFromMajor(100, "JPY")).toEqual({ amountMinor: 100, currency: "JPY" });
    expect(moneyFromMajor(null, "USD")).toBeNull();
    expect(majorString({ amountMinor: 12345, currency: "SEK" })).toBe("123.45");
  });

  it("counts SMS segments for GSM and Unicode text", () => {
    expect(smsSegments("a".repeat(160))).toBe(1);
    expect(smsSegments("a".repeat(161))).toBe(2);
    expect(smsSegments("🙂".repeat(70))).toBe(1);
    expect(smsSegments("🙂".repeat(71))).toBe(2);
  });

  it("builds a balanced daily sales voucher and refuses an unbalanced one", () => {
    const voucher = dailySalesVoucher({
      date: "2026-11-16", timeZone: "Europe/Stockholm", currency: "SEK", reference: "day-2026-11-16",
      sales: [{ account: "3001", vatRatePercent: 25, net: { amountMinor: 80000, currency: "SEK" }, vat: { amountMinor: 20000, currency: "SEK" }, vatAccount: "2611" }],
      payments: [{ account: "1580", amount: { amountMinor: 100000, currency: "SEK" } }],
    });
    expect(isBalanced(voucher.rows)).toBe(true);
    expect(() => dailySalesVoucher({ date: "2026-11-16", timeZone: "UTC", currency: "SEK", reference: "x", sales: [], payments: [{ account: "1580", amount: { amountMinor: 1, currency: "SEK" } }] })).toThrow();
  });
});

describe("simulated adapters", () => {
  const outbox = createOutbox();
  const ports = simulatedAdapters({ outbox, currency: "EUR" });

  it("exist for every port and say they are simulated", () => {
    for (const port of PORTS) {
      expect(ports[port].info).toMatchObject({ port, provider: "simulated", kind: "simulated", secrets: [] });
    }
  });

  it("are deterministic and record each send once", async () => {
    outbox.clear();
    const message = { to: "+46700000001", body: "Hello", reference: "r1", idempotencyKey: "k1" };
    const first = await ports.sms.send(message);
    const second = await ports.sms.send(message);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: true, status: "simulated", cost: { amountMinor: 0, currency: "EUR" } });
    expect(outbox.list("sms")).toHaveLength(1);
  });

  it("refuse invalid input with a normalised error", async () => {
    const result = await ports.sms.send({ to: "0701234567", body: "Hello" });
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_input", port: "sms", provider: "simulated", retryable: false } });
    const email = await ports.email.send({ to: ["not an address"], from: "a@b.example", subject: "S", text: "T" });
    expect(email.ok).toBe(false);
  });

  it("cover payments, accounting, calendar, listing, social and ads without the network", async () => {
    const checkout = await ports.payments.createCheckout({ amount: { amountMinor: 49900, currency: "SEK" }, description: "Haircut", reference: "b-1", successUrl: "https://x.example/ok", cancelUrl: "https://x.example/no", idempotencyKey: "b-1-pay" });
    expect(checkout.ok && new URL(checkout.value.url).hostname).toBe("checkout.invalid");
    expect((await ports.payments.verifyWebhook({ url: "https://x.example", method: "POST", headers: {}, rawBody: "{}" })).ok).toBe(false);
    expect((await ports.accounting.postVoucher({ date: "2026-11-16", description: "Day", currency: "SEK", reference: "d", rows: [{ account: "1580", debitMinor: 100, creditMinor: 0 }, { account: "3001", debitMinor: 0, creditMinor: 100 }] })).ok).toBe(true);
    const pushed = await ports.calendar.pushEvent("primary", { id: "b-1", title: "Haircut", start: "2026-11-18T09:00:00Z", end: "2026-11-18T09:45:00Z", timeZone: "Europe/Stockholm" });
    expect(pushed.ok).toBe(true);
    const pulled = await ports.calendar.pullEvents({ calendarId: "primary" });
    expect(pulled.ok && pulled.value.events[0].ownId).toBe("b-1");
    expect((await ports.social.publish({ channel: "instagram", caption: "Autumn offer", imageUrl: "https://media.invalid/x.png", reference: "c-1" })).ok).toBe(true);
    expect((await ports.social.publish({ channel: "instagram", caption: "x", imageUrl: "http://plain.example/x.png", reference: "c-1" })).ok).toBe(false);
    expect((await ports.ads.createDraft({ name: "Autumn", objective: "traffic", dailyBudget: { amountMinor: 10000, currency: "SEK" }, start: "2026-11-18T00:00:00Z", end: "2026-11-25T00:00:00Z", country: "SE", radiusKm: 5, reference: "c-1" }))).toMatchObject({ ok: true, value: { state: "paused" } });
    const feeds = ports.listing.buildFeeds({
      merchant: { id: "m-1", name: "Salon", url: "https://salon.example", address: { street: "Street 1", locality: "Town", postalCode: "11111", country: "SE" }, timeZone: "Europe/Stockholm", language: "sv-SE" },
      services: [{ id: "s-1", name: "Cut", price: { amountMinor: 49900, currency: "SEK" }, durationMinutes: 45 }],
      slots: [{ serviceId: "s-1", start: "2026-11-18T09:00:00Z", durationMinutes: 45, spotsOpen: 1 }],
    }, "2026-11-18T00:00:00Z");
    expect(feeds.ok && feeds.value.map((f) => f.name)).toEqual(["merchant_2026-11-18.json", "service_2026-11-18.json", "availability_2026-11-18.json"]);
    if (feeds.ok) expect(JSON.parse(feeds.value[1].body).service[0].price).toEqual({ price_micros: "499000000", currency_code: "SEK" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts recipient references only in simulation", () => {
    const sms = simulatedSms({ outbox: createOutbox() });
    expect(sms.deliver({ to: "customer:c-1", body: "Hi" }).ok).toBe(true);
    expect(sms.deliver({ to: "customer:../../etc", body: "Hi" }).ok).toBe(false);
  });
});

describe("demo sends go through the ports", () => {
  const booking = state.bookings.find((b) => b.status === "booked" && b.date > today)!;

  it("records a booking reminder in the outbox without changing the inbox item", () => {
    const next = reduce(state, { type: "booking-message/send", bookingId: booking.id, kind: "reminder", channel: "sms", at });
    const [entry] = demoOutbox.list("sms");
    expect(entry).toMatchObject({ port: "sms", to: `customer:${booking.customerId}`, body: bookingMessage(state, booking, "reminder").body });
    expect(next.inbox[0]).toMatchObject({ body: entry.body, delivery: { kind: "reminder", channel: "sms" } });
    reduce(state, { type: "booking-message/send", bookingId: booking.id, kind: "reminder", channel: "sms", at });
    expect(demoOutbox.list("sms")).toHaveLength(1);
  });

  it("texts the waiting list when a cancellation offers the slot", () => {
    const notice = { kind: "system" as const, date: today, time: 540, title: "t", body: "b", read: false, handled: true };
    reduce({ ...state, modules: { ...state.modules, waitlist: true } }, { type: "booking/cancel", id: booking.id, reason: "other", notice });
    expect(demoOutbox.list("sms")).toEqual([expect.objectContaining({ to: "segment:waitlist", body: expect.stringContaining(state.salon.name) })]);
    demoOutbox.clear();
    reduce(state, { type: "booking/cancel", id: booking.id, reason: "other" });
    expect(demoOutbox.list()).toHaveLength(0);
  });

  it("posts a campaign that goes live today to each channel, and nothing for a planned one", () => {
    const campaign = { name: "Test offer", serviceIds: ["classic-60"], discountPercent: 20, from: today, to: "2026-11-30", channels: ["instagram", "sms", "newsletter"] as Channel[], publishOn: today, copy: { instagram: "Hi" } };
    reduce(state, { type: "campaign/launch", today, campaign: { ...campaign, publishOn: "2026-11-20" } });
    expect(demoOutbox.list()).toHaveLength(0);
    reduce(state, { type: "campaign/launch", today, campaign });
    expect(demoOutbox.list().map((e) => `${e.port}:${e.action}`).sort()).toEqual(["email:send", "sms:send", "social:instagram"]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
