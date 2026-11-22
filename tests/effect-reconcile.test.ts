import { describe, expect, it } from "vitest";
import type { DeliveryState } from "@/concept/connections/simulated/outbox";
import { decide, type EffectRow } from "@/lib/effect-reconcile";
import { formatAge, formatList, maskAddress, parseReconcileArgs } from "@/lib/effect-reconcile-cli";

// The operator's reconcile tool without a database: its command line, how a row
// is shown, and what each action decides for a row. Fictional ids only.

describe("the command line", () => {
  it("lists every tenant by default, or one", () => {
    expect(parseReconcileArgs(["list"])).toEqual({ command: "list", limit: 200 });
    expect(parseReconcileArgs(["list", "--tenant", "salon-1", "--limit", "5"])).toEqual({ command: "list", tenant: "salon-1", limit: 5 });
  });

  it("is a dry run unless --apply, names the actor and drops repeated ids", () => {
    expect(parseReconcileArgs(["retry", "e-1", "e-2", "e-1", "--tenant", "salon-1"], { USER: "ops" }))
      .toEqual({ command: "retry", ids: ["e-1", "e-2"], tenant: "salon-1", apply: false, forceMaybeDuplicate: false, actor: "ops" });
    expect(parseReconcileArgs(["mark-sent", "e-1", "--tenant", "salon-1", "--apply", "--actor", "jane.d"]))
      .toMatchObject({ command: "mark-sent", apply: true, actor: "jane.d" });
    expect(parseReconcileArgs(["retry", "e-1", "--tenant", "salon-1", "--force-maybe-duplicate"])).toMatchObject({ forceMaybeDuplicate: true, actor: "operator" });
  });

  it("refuses what it cannot do safely", () => {
    const cases: Array<[string[], string]> = [
      [[], "unknown_command"],
      [["delete", "e-1", "--tenant", "t"], "unknown_command"],
      [["retry", "e-1", "--bogus"], "unknown_option"],
      [["retry", "--tenant", "t"], "no_ids"],
      [["retry", "e-1"], "tenant_required"],
      [["mark-failed", "e-1", "--tenant", "t", "--force-maybe-duplicate"], "force_is_for_retry"],
      [["retry", "e 1", "--tenant", "t"], "invalid_id"],
      [["retry", "e-1", "--tenant", "t'; --"], "invalid_tenant"],
      [["retry", "e-1", "--tenant", "t", "--actor", "a b"], "invalid_actor"],
      [["retry", "e-1", "--tenant", "t", "--limit", "3"], "limit_is_for_list"],
      [["list", "e-1"], "list_takes_no_ids"],
      [["list", "--apply"], "list_changes_nothing"],
      [["list", "--limit", "0"], "invalid_limit"],
      [["list", "--limit", "x"], "invalid_limit"],
      [["retry", ...Array.from({ length: 101 }, (_, i) => `e-${i}`), "--tenant", "t"], "too_many_ids"],
    ];
    for (const [argv, error] of cases) expect(parseReconcileArgs(argv), argv.join(" ")).toEqual({ error });
  });
});

describe("what is shown of a row", () => {
  it("masks an address to its domain", () => {
    expect(maskAddress("lisa.berg@Example.TEST")).toBe("***@example.test");
    expect(maskAddress("a@b@sub.example.test")).toBe("***@sub.example.test");
    for (const value of [undefined, "", "lisa", "@example.test", "lisa@", "lisa@localhost", "x@exa mple.test"]) expect(maskAddress(value)).toBe("-");
  });

  it("gives an age in its two largest units", () => {
    expect(formatAge(45_000)).toBe("45s");
    expect(formatAge(12 * 60_000 + 5_000)).toBe("12m");
    expect(formatAge(3 * 3_600_000 + 12 * 60_000)).toBe("3h12m");
    expect(formatAge(2 * 86_400_000 + 4 * 3_600_000)).toBe("2d4h");
    expect(formatAge(undefined)).toBe("-");
    expect(formatAge(-1)).toBe("-");
  });

  it("groups rows per tenant and prints no content", () => {
    const lines = formatList([
      { id: "e-1", tenantId: "t-1", kind: "email/confirmation", state: "uncertain", ageMs: 3_600_000, attempts: 1, error: "uncertain", dispatched: true, recipient: "***@example.test" },
      { id: "e-2", tenantId: "t-1", kind: "email/cancellation", state: "failed", attempts: 10, error: "EMAIL_NOT_CONFIGURED", dispatched: false, recipient: "-" },
      { id: "e-3", tenantId: "t-2", kind: "payments/checkout", state: "failed", attempts: 10, dispatched: false, reconciled: "retried", recipient: "-" },
    ]);
    expect(lines).toEqual([
      "tenant t-1",
      "  e-1  email/confirmation  uncertain  age 1h0m  attempts 1  error uncertain  dispatched  to ***@example.test",
      "  e-2  email/cancellation  failed  age -  attempts 10  error EMAIL_NOT_CONFIGURED  not-dispatched  to -",
      "tenant t-2",
      "  e-3  payments/checkout  failed  age -  attempts 10  error -  not-dispatched  reconciled retried  to -",
    ]);
    expect(formatList([])).toEqual(["No failed or uncertain effects."]);
  });
});

describe("what each action decides", () => {
  const frozen: DeliveryState = {
    firstAttemptAt: 1, mail: { subject: "s", text: "t", html: "h" }, link: { url: "https://x.example/b", exp: 2 }, from: "\"Salon\" <bookings@x.example>", replyTo: "salon@x.example",
  };
  const row = (status: string, delivery: DeliveryState = {}, over: Partial<EffectRow> = {}): EffectRow => ({
    id: "e-1", tenant_id: "t-1", kind: "message", status, erased: false, leased: false,
    payload: { id: "o-1", port: "email", action: "send", body: "x", cost: null, live: true, delivery }, ...over,
  });

  it("retries a failed row that never left, keeping what was frozen", () => {
    expect(decide("retry", row("failed", { ...frozen, lastError: "EMAIL_NOT_CONFIGURED" }), "t-1"))
      .toEqual({ outcome: "change", status: "pending", delivery: { ...frozen, reconciled: "retried" }, resetAttempts: true });
  });

  it("retries a dispatched row only when forced, and then drops the marker but not the frozen message", () => {
    const dispatched = row("failed", { ...frozen, dispatched: true, provider: "resend", account: "abcd", reason: "uncertain" });
    expect(decide("retry", dispatched, "t-1")).toEqual({ outcome: "refused", reason: "dispatched" });
    expect(decide("retry", dispatched, "t-1", true)).toEqual({ outcome: "change", status: "pending", delivery: { ...frozen, reconciled: "retried" }, resetAttempts: true });
  });

  it("refuses another tenant's row, anything not an e-mail, erased, cancelled, sent or leased rows", () => {
    expect(decide("retry", undefined, "t-1")).toEqual({ outcome: "refused", reason: "not_found" });
    expect(decide("retry", row("failed"), "t-2")).toEqual({ outcome: "refused", reason: "tenant_mismatch" });
    expect(decide("retry", row("failed", {}, { kind: "payment" }), "t-1")).toEqual({ outcome: "refused", reason: "not_email" });
    expect(decide("retry", row("failed", {}, { payload: { ...row("failed").payload, port: "sms" } }), "t-1")).toEqual({ outcome: "refused", reason: "not_email" });
    expect(decide("retry", row("failed", {}, { erased: true }), "t-1")).toEqual({ outcome: "refused", reason: "erased" });
    expect(decide("retry", row("cancelled"), "t-1")).toEqual({ outcome: "refused", reason: "cancelled" });
    expect(decide("retry", row("failed", { sent: true }), "t-1", true)).toEqual({ outcome: "refused", reason: "already_sent" });
    expect(decide("retry", row("failed", {}, { leased: true }), "t-1")).toEqual({ outcome: "refused", reason: "leased" });
  });

  it("changes nothing the second time", () => {
    expect(decide("retry", row("pending", { reconciled: "retried" }), "t-1")).toEqual({ outcome: "unchanged", reason: "pending" });
    expect(decide("retry", row("delivered", { sent: true }), "t-1")).toEqual({ outcome: "unchanged", reason: "delivered" });
    expect(decide("mark-sent", row("delivered", { sent: true, reconciled: "sent" }), "t-1")).toEqual({ outcome: "unchanged", reason: "delivered" });
    expect(decide("mark-failed", row("failed", { reason: "not_sent", reconciled: "not_sent", dispatched: true }), "t-1")).toEqual({ outcome: "unchanged", reason: "not_sent" });
  });

  it("settles only an uncertain row as sent or not sent", () => {
    const uncertain = row("failed", { firstAttemptAt: 1, dispatched: true, provider: "postmark", reason: "uncertain", lastError: "EMAIL_UNCERTAIN" });
    expect(decide("mark-sent", uncertain, "t-1")).toEqual({ outcome: "change", status: "delivered", delivery: { firstAttemptAt: 1, sent: true, reconciled: "sent" }, resetAttempts: false });
    expect(decide("mark-failed", uncertain, "t-1")).toEqual({
      outcome: "change", status: "failed", delivery: { firstAttemptAt: 1, dispatched: true, provider: "postmark", reason: "not_sent", reconciled: "not_sent" }, resetAttempts: false,
    });
    expect(decide("mark-sent", row("failed", { reason: "invalid_input" }), "t-1")).toEqual({ outcome: "refused", reason: "not_uncertain" });
    expect(decide("mark-failed", row("failed", { lastError: "EMAIL_NOT_CONFIGURED" }), "t-1")).toEqual({ outcome: "refused", reason: "not_uncertain" });
    expect(decide("mark-sent", row("pending", { dispatched: true }), "t-1")).toEqual({ outcome: "refused", reason: "pending" });
    expect(decide("mark-failed", row("delivered"), "t-1")).toEqual({ outcome: "refused", reason: "delivered" });
    expect(decide("mark-sent", { ...uncertain, leased: true }, "t-1")).toEqual({ outcome: "refused", reason: "leased" });
  });
});
