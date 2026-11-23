import { describe, expect, it } from "vitest";
import type { DeliveryState } from "@/concept/connections/simulated/outbox";
import { decide, isUncertain, shownError, type EffectRow } from "@/lib/effect-reconcile";
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
    expect(parseReconcileArgs(["mark-sent", "e-1", "--tenant", "salon-1", "--apply", "--actor", "jd-01"]))
      .toMatchObject({ command: "mark-sent", apply: true, actor: "jd-01" });
    // A staff handle; the runbook asks for one rather than a full name.
    expect(parseReconcileArgs(["retry", "e-1", "--tenant", "salon-1", "--actor", "janedoe"])).toMatchObject({ actor: "janedoe" });
    expect(parseReconcileArgs(["retry", "e-1", "--tenant", "salon-1", "--force-maybe-duplicate"])).toMatchObject({ forceMaybeDuplicate: true, actor: "operator" });
    // An actor is an opaque id: a shell user that looks like an address is not echoed into the audit line.
    for (const USER of ["jane@example.test", "Jane Doe", "jane.doe", "0735551234", "x".repeat(33)]) {
      expect(parseReconcileArgs(["retry", "e-1", "--tenant", "salon-1"], { USER })).toMatchObject({ actor: "operator" });
    }
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
      [["retry", "e-1", "--tenant", "t", "--actor", "jane@example.test"], "invalid_actor"],
      [["retry", "e-1", "--tenant", "t", "--actor", "Jane"], "invalid_actor"],
      [["retry", "e-1", "--tenant", "t", "--actor", "jane.doe"], "invalid_actor"],
      [["retry", "e-1", "--tenant", "t", "--actor", "0735551234"], "invalid_actor"],
      [["retry", "e-1", "--tenant", "t", "--actor", "073-555-1234"], "invalid_actor"],
      [["retry", "e-1", "--tenant", "t", "--actor", "ops_12_34_56"], "invalid_actor"],
      [["retry", "e-1", "--tenant", "t", "--actor", "x".repeat(33)], "invalid_actor"],
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
      { id: "e-1", tenantId: "t-1", kind: "email/confirmation", state: "uncertain", ageMs: 3_600_000, attempts: 1, error: "uncertain", dispatched: true, firstAttemptAt: Date.UTC(2026, 10, 16, 9), submittedAt: Date.UTC(2026, 10, 17, 9, 30), recipient: "***@example.test" },
      { id: "e-2", tenantId: "t-1", kind: "email/cancellation", state: "failed", attempts: 10, error: "EMAIL_NOT_CONFIGURED", dispatched: false, recipient: "-" },
      { id: "e-3", tenantId: "t-2", kind: "payments/checkout", state: "failed", attempts: 10, dispatched: false, reconciled: "retried", recipient: "-" },
    ]);
    expect(lines).toEqual([
      "tenant t-1",
      "  e-1  email/confirmation  uncertain  age 1h0m  attempts 1  error uncertain  dispatched  rendered 2026-11-16T09:00:00Z  submitted 2026-11-17T09:30:00Z  to ***@example.test",
      "  e-2  email/cancellation  failed  age -  attempts 10  error EMAIL_NOT_CONFIGURED  not-dispatched  rendered -  submitted -  to -",
      "tenant t-2",
      "  e-3  payments/checkout  failed  age -  attempts 10  error -  not-dispatched  rendered -  submitted -  reconciled retried  to -",
    ]);
    expect(formatList([])).toEqual(["No failed or uncertain effects."]);
  });
});

describe("what each action decides", () => {
  const frozen: DeliveryState = {
    firstAttemptAt: 1, mail: { subject: "s", text: "t", html: "h" }, link: { url: "https://x.example/b", exp: 2 }, from: "\"Salon\" <bookings@x.example>", replyTo: "salon@x.example",
  };
  const row = (status: string, delivery: DeliveryState = {}, over: Partial<EffectRow> = {}): EffectRow => ({
    id: "e-1", tenant_id: "t-1", kind: "message", status, attempts: 10, deliverable: true, erased: false, leased: false,
    payload: { id: "o-1", port: "email", action: "send", body: "x", cost: null, live: true, delivery }, ...over,
  });

  it("retries a failed row that never left, keeping what was frozen", () => {
    expect(decide("retry", row("failed", { ...frozen, lastError: "EMAIL_NOT_CONFIGURED" }), "t-1"))
      .toEqual({ outcome: "change", status: "pending", delivery: { ...frozen, attemptBase: 10, reconciled: "retried" }, reopen: true });
  });

  it("retries a dispatched row only when forced, and then drops the marker but not the frozen message", () => {
    const dispatched = row("failed", { ...frozen, dispatched: true, provider: "resend", account: "abcd", reason: "uncertain" });
    expect(decide("retry", dispatched, "t-1")).toEqual({ outcome: "refused", reason: "dispatched" });
    expect(decide("retry", dispatched, "t-1", true)).toEqual({ outcome: "change", status: "pending", delivery: { ...frozen, attemptBase: 10, reconciled: "retried" }, reopen: true });
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

  it("treats an exhausted send that may have left as uncertain, even without a marker", () => {
    const exhausted = row("failed", { ...frozen, lastError: "EMAIL_UNCERTAIN" });
    expect(isUncertain("failed", exhausted.payload.delivery!)).toBe(true);
    // A timeout says nothing by itself: a request in flight keeps its marker, one that never started has it released.
    expect(isUncertain("failed", { lastError: "STUDIO_STORE_SINK_TIMEOUT" })).toBe(false);
    expect(isUncertain("failed", { dispatched: true, lastError: "STUDIO_STORE_SINK_TIMEOUT" })).toBe(true);
    expect(isUncertain("failed", { lastError: "EMAIL_NOT_CONFIGURED" })).toBe(false);
    expect(isUncertain("failed", { dispatched: true, lastError: "EMAIL_RETRYABLE" })).toBe(true);
    expect(isUncertain("pending", { reason: "uncertain" })).toBe(false);
    expect(decide("retry", exhausted, "t-1")).toEqual({ outcome: "refused", reason: "uncertain" });
    expect(decide("retry", exhausted, "t-1", true)).toMatchObject({ outcome: "change", status: "pending" });
    expect(decide("mark-sent", exhausted, "t-1")).toMatchObject({ outcome: "change", status: "delivered" });
    // Settled as not sent, it still needs the force flag to go out again.
    expect(decide("retry", row("failed", { ...frozen, reason: "not_sent" }), "t-1")).toEqual({ outcome: "refused", reason: "uncertain" });
  });

  it("refuses a booking that is gone, cancelled or erased, and a snapshot retention purged", () => {
    expect(decide("retry", row("failed", frozen, { deliverable: false }), "t-1")).toEqual({ outcome: "refused", reason: "booking_gone" });
    const purged = { firstAttemptAt: 1, from: frozen.from, link: frozen.link };
    expect(decide("retry", row("failed", purged), "t-1")).toEqual({ outcome: "refused", reason: "snapshot_purged" });
    expect(decide("retry", row("failed", { reason: "snapshot_purged" }), "t-1")).toEqual({ outcome: "refused", reason: "snapshot_purged" });
    // Rendered once but not kept (an older row, or one settled as uncertain): a retry would send new content.
    expect(decide("retry", row("failed", { firstAttemptAt: 1, lastError: "EMAIL_RETRYABLE" }), "t-1")).toEqual({ outcome: "refused", reason: "snapshot_missing" });
    expect(decide("retry", row("failed", { firstAttemptAt: 1, dispatched: true, reason: "uncertain" }), "t-1", true)).toEqual({ outcome: "refused", reason: "snapshot_missing" });
    // Never frozen (it ran out of attempts before the first render): rebuilt from the booking.
    expect(decide("retry", row("failed", { lastError: "EMAIL_NOT_CONFIGURED" }), "t-1")).toMatchObject({ outcome: "change" });
  });

  it("shows only allowlisted reasons and codes", () => {
    expect(shownError({ reason: "invalid_input" })).toBe("invalid_input");
    expect(shownError({ reason: "uncertain" })).toBe("uncertain");
    expect(shownError({ reason: "LISA@EXAMPLE.TEST" })).toBe("other");
    expect(shownError({ lastError: "EMAIL_NOT_CONFIGURED" })).toBe("EMAIL_NOT_CONFIGURED");
    expect(shownError({ lastError: "CUSTOMER_LISA_BERG" })).toBe("other");
    expect(shownError({})).toBeUndefined();
  });

  it("changes nothing the second time", () => {
    expect(decide("retry", row("pending", { reconciled: "retried" }), "t-1")).toEqual({ outcome: "unchanged", reason: "pending" });
    expect(decide("retry", row("delivered", { sent: true }), "t-1")).toEqual({ outcome: "unchanged", reason: "delivered" });
    expect(decide("mark-sent", row("delivered", { sent: true, reconciled: "sent" }), "t-1")).toEqual({ outcome: "unchanged", reason: "delivered" });
    expect(decide("mark-failed", row("failed", { reason: "not_sent", reconciled: "not_sent", dispatched: true }), "t-1")).toEqual({ outcome: "unchanged", reason: "not_sent" });
  });

  it("settles only an uncertain row as sent or not sent", () => {
    const reused = row("failed", { firstAttemptAt: 1, dispatched: true, provider: "resend", reason: "reconcile" });
    expect(decide("mark-sent", reused, "t-1")).toMatchObject({ outcome: "change", status: "delivered" });
    expect(decide("mark-failed", reused, "t-1")).toMatchObject({ outcome: "change", status: "failed", delivery: { reason: "not_sent" } });
    expect(decide("mark-sent", row("failed", { reason: "reconcile" }), "t-1")).toEqual({ outcome: "refused", reason: "not_uncertain" });
    const uncertain = row("failed", { firstAttemptAt: 1, dispatched: true, provider: "postmark", reason: "uncertain", lastError: "EMAIL_UNCERTAIN" });
    expect(decide("mark-sent", uncertain, "t-1")).toEqual({ outcome: "change", status: "delivered", delivery: { firstAttemptAt: 1, sent: true, reconciled: "sent" }, reopen: false });
    expect(decide("mark-failed", uncertain, "t-1")).toEqual({
      outcome: "change", status: "failed", delivery: { firstAttemptAt: 1, dispatched: true, provider: "postmark", reason: "not_sent", reconciled: "not_sent" }, reopen: false,
    });
    expect(decide("mark-sent", row("failed", { reason: "invalid_input" }), "t-1")).toEqual({ outcome: "refused", reason: "not_uncertain" });
    expect(decide("mark-failed", row("failed", { lastError: "EMAIL_NOT_CONFIGURED" }), "t-1")).toEqual({ outcome: "refused", reason: "not_uncertain" });
    expect(decide("mark-sent", row("pending", { dispatched: true }), "t-1")).toEqual({ outcome: "refused", reason: "pending" });
    expect(decide("mark-failed", row("delivered"), "t-1")).toEqual({ outcome: "refused", reason: "delivered" });
    expect(decide("mark-sent", { ...uncertain, leased: true }, "t-1")).toEqual({ outcome: "refused", reason: "leased" });
  });
});
