import { describe, expect, it } from "vitest";
import { GUARD_CAP, LOCK_THRESHOLD, MAILBOX_CAP, MAILBOX_LIMIT, MAILBOX_WINDOW_MS, lockDurationMs, memoryLoginGuard, memoryMailboxQuota } from "../src/lib/owner-guard-store";

// The in-process owner guard stores with a fixed clock. All addresses are fictional.

const T0 = Date.UTC(2026, 10, 22, 10, 0, 0);
const minutes = (n: number) => n * 60_000;

describe("owner login guard (memory)", () => {
  it("locks on the fifth real failure and not before", async () => {
    const guard = memoryLoginGuard();
    for (let n = 1; n < LOCK_THRESHOLD; n++) {
      await guard.failed("a@example.test", T0 + n);
      expect(await guard.locked("a@example.test", T0 + n)).toBe(false);
    }
    await guard.failed("a@example.test", T0 + 10);
    expect(await guard.locked("a@example.test", T0 + 11)).toBe(true);
    expect(await guard.locked("a@example.test", T0 + minutes(16))).toBe(false);
  });

  it("counts a burst past the threshold as one lock-out", async () => {
    const guard = memoryLoginGuard();
    await Promise.all(Array.from({ length: 40 }, () => guard.failed("b@example.test", T0)));
    expect(await guard.locked("b@example.test", T0 + minutes(14))).toBe(true);
    expect(await guard.locked("b@example.test", T0 + minutes(16))).toBe(false);
  });

  it("doubles later locks within a day and forgets them after it", async () => {
    const guard = memoryLoginGuard();
    let now = T0;
    const lockOut = async () => { for (let n = 0; n < LOCK_THRESHOLD; n++) await guard.failed("c@example.test", now); };
    await lockOut();
    now += minutes(16);
    await lockOut();
    expect(await guard.locked("c@example.test", now + minutes(29))).toBe(true);
    expect(await guard.locked("c@example.test", now + minutes(31))).toBe(false);
    now += 25 * 3600_000;
    await lockOut();
    expect(await guard.locked("c@example.test", now + minutes(16))).toBe(false);
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => lockDurationMs(n) / minutes(1))).toEqual([15, 30, 60, 120, 240, 480, 480]);
  });

  it("clears failures on success, but a locked address cannot succeed", async () => {
    const guard = memoryLoginGuard();
    for (let n = 0; n < 4; n++) await guard.failed("d@example.test", T0);
    expect(await guard.succeeded("d@example.test", T0)).toBe(true);
    for (let n = 0; n < 4; n++) await guard.failed("d@example.test", T0);
    expect(await guard.locked("d@example.test", T0)).toBe(false);
    await guard.failed("d@example.test", T0);
    expect(await guard.succeeded("d@example.test", T0 + 1)).toBe(false);
    await guard.lift("d@example.test");
    expect(await guard.locked("d@example.test", T0 + 2)).toBe(false);
  });

  it("counts failures per window: old failures do not add up", async () => {
    const guard = memoryLoginGuard();
    for (let n = 0; n < 4; n++) await guard.failed("e@example.test", T0);
    await guard.failed("e@example.test", T0 + minutes(16));
    expect(await guard.locked("e@example.test", T0 + minutes(16))).toBe(false);
  });

  it("is bounded: expired entries are dropped, and an active lock outlives a flood of other addresses", async () => {
    const guard = memoryLoginGuard();
    for (let n = 0; n < LOCK_THRESHOLD; n++) await guard.failed("victim@example.test", T0);
    for (let n = 0; n < GUARD_CAP + 500; n++) await guard.failed(`flood-${n}@example.test`, T0 + 1);
    expect(guard.size()).toBeLessThanOrEqual(GUARD_CAP);
    expect(await guard.locked("victim@example.test", T0 + 2)).toBe(true);
    // A day later everything has expired and a periodic prune empties the map.
    await guard.locked("someone@example.test", T0 + 2 * 24 * 3600_000);
    expect(guard.size()).toBe(0);
  });
});

describe("reset mailbox quota (memory)", () => {
  it("allows three mails per window and then none until it ends", async () => {
    const quota = memoryMailboxQuota();
    for (let n = 0; n < MAILBOX_LIMIT; n++) {
      expect(await quota.available("a@example.test", T0 + n)).toBe(true);
      await quota.spend("a@example.test", T0 + n);
    }
    expect(await quota.available("a@example.test", T0 + 10)).toBe(false);
    expect(await quota.available("a@example.test", T0 + MAILBOX_WINDOW_MS + 1)).toBe(true);
  });

  it("checking spends nothing", async () => {
    const quota = memoryMailboxQuota();
    for (let n = 0; n < 10; n++) await quota.available("b@example.test", T0);
    expect(await quota.available("b@example.test", T0)).toBe(true);
  });

  it("has a cap of its own", async () => {
    const quota = memoryMailboxQuota();
    for (let n = 0; n < MAILBOX_CAP + 50; n++) await quota.spend(`m-${n}@example.test`, T0);
    // The oldest were dropped to make room; the newest are still counted.
    expect(await quota.available("m-0@example.test", T0)).toBe(true);
    for (let n = 0; n < MAILBOX_LIMIT - 1; n++) await quota.spend(`m-${MAILBOX_CAP + 49}@example.test`, T0);
    expect(await quota.available(`m-${MAILBOX_CAP + 49}@example.test`, T0)).toBe(false);
  });
});
