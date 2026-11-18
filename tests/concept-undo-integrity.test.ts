import { describe, expect, it } from "vitest";
import { addDays } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";
import type { DemoState } from "@/concept/data/types";
import { balanceOf } from "@/concept/giftcards/cards";
import { applyAction } from "@/concept/log/capture";
import type { LogMeta } from "@/concept/log/types";
import { undoBlockReason } from "@/concept/log/undo";
import { canRestore, restoreBlockReason, restoreEntry } from "@/concept/trash/trash";

// Regressions for two Codex review findings on PR #31: undo must not orphan a
// customer that later records still point to, and restoring or undoing a
// cancelled booking must not spend a gift card balance twice.

const today = "2026-11-16";
const base = createDemoState(today);
const meta: LogMeta = { actor: "owner", source: "button", at: 0 };
const upcoming = base.bookings.filter((b) => b.status === "booked" && b.date > today && b.price >= 100);

/** A free time for the same staff member and treatment as `like`, from `from` on. */
function freeTime(state: DemoState, like: (typeof upcoming)[number], from: string) {
  let date = from;
  while (!freeStarts(state, like.staffId, date, like).length) date = addDays(date, 1);
  return { date, start: freeStarts(state, like.staffId, date, like)[0] };
}

describe("undo keeps customers that later records use", () => {
  const like = upcoming[0];
  const newCustomer = { name: "QA Firstvisit", phone: "070-000 99 41", email: "qa-first@example.test", since: today };

  function bookTwice() {
    const first = freeTime(base, like, addDays(today, 3));
    const once = applyAction(base, { type: "booking/create", newCustomer, serviceId: like.serviceId, staffId: like.staffId, ...first, source: "phone" }, meta);
    const customer = once.customers.find((c) => c.firstName === "QA" || `${c.firstName} ${c.lastName}`.includes("Firstvisit"))!;
    const firstEntry = once.log[0];
    const second = freeTime(once, like, addDays(first.date, 2));
    const twice = applyAction(once, { type: "booking/create", customerId: customer.id, serviceId: like.serviceId, staffId: like.staffId, ...second, source: "phone" }, meta);
    return { once, twice, customer, firstEntry };
  }

  it("refuses to undo a new customer's first booking once they have another booking", () => {
    const { twice, customer, firstEntry } = bookTwice();
    expect(twice.bookings.filter((b) => b.customerId === customer.id)).toHaveLength(2);
    expect(undoBlockReason(twice, firstEntry)).toBe("customer-in-use");
    const after = applyAction(twice, { type: "log/undo", id: firstEntry.id }, meta);
    expect(after).toBe(twice);
    expect(after.customers.some((c) => c.id === customer.id)).toBe(true);
  });

  it("still undoes the first booking, customer and all, when nothing else uses the customer", () => {
    const { once, customer, firstEntry } = bookTwice();
    expect(undoBlockReason(once, firstEntry)).toBeUndefined();
    const undone = applyAction(once, { type: "log/undo", id: firstEntry.id }, meta);
    expect(undone.customers.some((c) => c.id === customer.id)).toBe(false);
    expect(undone.bookings.some((b) => b.customerId === customer.id)).toBe(false);
  });
});

describe("gift card balance is never spent twice", () => {
  const [a, b] = upcoming;

  /** Card pays A, A is cancelled, the refunded balance pays B. */
  function spentTwice() {
    const sold = applyAction(base, { type: "giftcard/sell", amount: 100, recipient: "QA Card", message: "", date: today }, meta);
    const card = sold.giftCards.at(-1)!;
    const paidA = applyAction(sold, { type: "giftcard/redeem", code: card.code, bookingId: a.id, date: today }, meta);
    const cancelledA = applyAction(paidA, { type: "booking/cancel", id: a.id }, meta);
    const cancelEntry = cancelledA.log[0];
    expect(balanceOf(cancelledA, cancelledA.giftCards.at(-1)!)).toBe(100);
    const paidB = applyAction(cancelledA, { type: "giftcard/redeem", code: card.code, bookingId: b.id, date: today }, meta);
    expect(balanceOf(paidB, paidB.giftCards.at(-1)!)).toBe(0);
    const trashEntry = paidB.trash.find((e) => e.kind === "booking" && e.bookingId === a.id)!;
    return { paidB, cancelEntry, trashEntry };
  }

  it("refuses to restore the cancelled booking from the trash", () => {
    const { paidB, trashEntry } = spentTwice();
    expect(restoreBlockReason(paidB, trashEntry)).toBe("gift-card");
    expect(canRestore(paidB, trashEntry)).toBe(false);
    expect(restoreEntry(paidB, trashEntry.id)).toBe(paidB);
    expect(balanceOf(paidB, paidB.giftCards.at(-1)!)).toBe(0);
  });

  it("refuses to undo the cancellation from the activity log", () => {
    const { paidB, cancelEntry } = spentTwice();
    expect(undoBlockReason(paidB, cancelEntry)).toBe("gift-card");
    expect(applyAction(paidB, { type: "log/undo", id: cancelEntry.id }, meta)).toBe(paidB);
  });

  it("restores and undoes as before when the balance was not spent again", () => {
    const sold = applyAction(base, { type: "giftcard/sell", amount: 100, recipient: "QA Card", message: "", date: today }, meta);
    const card = sold.giftCards.at(-1)!;
    const paidA = applyAction(sold, { type: "giftcard/redeem", code: card.code, bookingId: a.id, date: today }, meta);
    const cancelledA = applyAction(paidA, { type: "booking/cancel", id: a.id }, meta);
    const trashEntry = cancelledA.trash.find((e) => e.kind === "booking" && e.bookingId === a.id)!;
    expect(restoreBlockReason(cancelledA, trashEntry)).toBeUndefined();
    const restored = restoreEntry(cancelledA, trashEntry.id);
    expect(restored.bookings.find((x) => x.id === a.id)?.status).toBe("booked");
    expect(balanceOf(restored, restored.giftCards.at(-1)!)).toBe(0);
    expect(undoBlockReason(cancelledA, cancelledA.log[0])).toBeUndefined();
  });
});
