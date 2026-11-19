import { describe, expect, it } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { toKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { canonicalJson, jsonEqual } from "@/concept/data/json-equal";
import { getActiveLocale, getVocabulary } from "@/concept/i18n";
import { formatMoney, getCurrency } from "@/concept/i18n/format";
import { withTenantPresentation } from "@/concept/i18n/presentation";
import { subjectIds } from "@/concept/store/postgres-studio-store";
import { effectId, requestFingerprint, stagedChannels, type StagedRequest } from "@/concept/store/staged-channels";
import { sameContent, withTrustedTimes } from "@/concept/store/studio-store";

// Pure helpers behind PostgresStudioStore. Fictional data only.

const today = toKey(new Date());

describe("jsonEqual", () => {
  it("ignores object key order but not values, array order or missing keys", () => {
    expect(jsonEqual({ a: 1, b: { c: [1, { d: 2, e: 3 }] } }, { b: { c: [1, { e: 3, d: 2 }] }, a: 1 })).toBe(true);
    expect(jsonEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(jsonEqual([undefined], [null])).toBe(true);
    expect(jsonEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(jsonEqual({ a: 1 }, { a: 1, b: 0 })).toBe(false);
    expect(jsonEqual({ a: "1" }, { a: 1 })).toBe(false);
    expect(canonicalJson({ b: 1, a: [{ d: 1, c: 2 }] })).toBe('{"a":[{"c":2,"d":1}],"b":1}');
  });

  it("makes sameContent blind to the key order a jsonb round trip produces", () => {
    const state = createDemoState(today);
    const reordered = JSON.parse(JSON.stringify(state, Object.keys(state).sort())) as typeof state;
    const deep = { ...state, page: Object.fromEntries(Object.entries(state.page).reverse()) as typeof state.page };
    expect(sameContent(state, { ...reordered, ...state })).toBe(true);
    expect(sameContent(state, deep)).toBe(true);
    expect(sameContent(state, { ...state, dismissedCards: [...state.dismissedCards, "x"] })).toBe(false);
  });
});

describe("withTrustedTimes", () => {
  const at = Date.UTC(2026, 10, 19, 17, 0); // 18:00 in Stockholm
  it("replaces the times that decide eligibility or access and keeps event stamps", () => {
    const hold: Extract<DemoAction, { type: "online/hold" }> = {
      type: "online/hold", serviceId: "s", staffId: createDemoState(today).staff[0].id, date: today, start: 600,
      guest: { name: "Fictional Guest", phone: "0700009911", at: { date: "2001-01-01", time: 0 } },
      notice: { title: "t", body: "b" },
    };
    expect(withTrustedTimes(hold, at)).toMatchObject({ guest: { at: { date: "2026-11-19", time: 18 * 60 } } });
    expect(hold.guest.at.date).toBe("2001-01-01");
    expect(withTrustedTimes({ type: "support/grant", hours: 1, at: 0 }, at)).toEqual({ type: "support/grant", hours: 1, at });
    expect(withTrustedTimes({ type: "support/revoke", at: 0 }, at)).toEqual({ type: "support/revoke", at });
    expect(withTrustedTimes({ type: "review/submit", bookingId: "b", rating: 5, text: "Fine", at: { date: "2099-01-01", time: 0 } }, at))
      .toMatchObject({ at: { date: "2026-11-19", time: 18 * 60 } });
    const order: DemoAction = { type: "stock/order", orders: [], at: { date: "2026-11-01", time: 60 } };
    expect(withTrustedTimes(order, at)).toBe(order);
  });
});

describe("durable effect ids", () => {
  const record = { id: "sim-payments-0000001", port: "payments" as const, action: "checkout", body: "Deposit", cost: null };
  const request = (key: string | null, input: unknown): StagedRequest => ({ port: "payments", operation: "checkout", key, request: input, record });

  it("come from the full provider key, not the short outbox record id", () => {
    // Two requests whose simulated records collide on id still get distinct effects.
    expect(effectId("t", request("salon-h1-deposit", { amount: 1 }))).not.toBe(effectId("t", request("salon-h2-deposit", { amount: 1 })));
    expect(effectId("t", request("k", { amount: 1 }))).toBe(effectId("t", request("k", { amount: 2 })));
    expect(requestFingerprint(request("k", { amount: 1 }))).not.toBe(requestFingerprint(request("k", { amount: 2 })));
    expect(effectId("t1", request("k", {}))).not.toBe(effectId("t2", request("k", {})));
    expect(effectId("t", request(null, { b: 1, a: 2 }))).toBe(effectId("t", request(null, { a: 2, b: 1 })));
  });

  it("are recorded with their request even when the record id repeats", () => {
    const stage = stagedChannels("EUR");
    const first = stage.sms.deliver({ to: "customer:c1", body: "Fictional text", reference: "r", idempotencyKey: "k1" });
    const again = stage.sms.deliver({ to: "customer:c1", body: "Fictional text", reference: "r", idempotencyKey: "k1" });
    expect(first.ok && again.ok).toBe(true);
    expect(stage.requests().map((r) => [r.port, r.operation, r.key])).toEqual([["sms", "send", "k1"], ["sms", "send", "k1"]]);
    stage.payments.checkoutNow({ reference: "ref", amount: { amountMinor: 100, currency: "EUR" }, description: "Deposit", methods: ["card"], successUrl: "", cancelUrl: "", idempotencyKey: "ref-deposit" });
    expect(stage.hasPayments()).toBe(true);
    expect(stage.requests().at(-1)).toMatchObject({ port: "payments", operation: "checkout", key: "ref-deposit" });
  });
});

describe("subjectIds", () => {
  it("finds customers named in nested action data even when no record with a customer changed", () => {
    const state = createDemoState(today);
    const [a, b] = state.customers;
    const action: DemoAction = { type: "customers/message", texts: [{ customerId: a.id, title: "t", body: "x" }, { customerId: b.id, title: "t", body: "y" }], at: { date: today, time: 0 } };
    expect(subjectIds(action, state, { ...state, seq: state.seq + 1 })).toEqual([a.id, b.id].sort());
    const journal = { type: "journal/add", entry: { customerId: a.id } } as unknown as DemoAction;
    expect(subjectIds(journal, state, { ...state, seq: state.seq + 1 })).toEqual([a.id]);
  });
});

describe("withTenantPresentation", () => {
  it("formats with the tenant's language and currency, then restores the process settings", () => {
    const base = createDemoState(today);
    const before = { language: getActiveLocale(), vocabulary: getVocabulary(), currency: getCurrency() };
    const text = withTenantPresentation({ ...base, localization: { ...base.localization, language: "sv", currency: "EUR" } }, () => [getActiveLocale(), formatMoney(12_300)]);
    expect(text[0]).toBe("sv");
    expect(text[1]).toContain("€");
    expect({ language: getActiveLocale(), vocabulary: getVocabulary(), currency: getCurrency() }).toEqual(before);
    expect(() => withTenantPresentation(base, () => { throw new Error("boom"); })).toThrow("boom");
    expect(getCurrency()).toBe(before.currency);
  });
});
