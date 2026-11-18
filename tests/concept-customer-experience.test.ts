import { describe, expect, it, vi } from "vitest";
import { reduce } from "@/concept/actions";
import { bookingMessage, messageWasSent } from "@/concept/booking/messages";
import { parseBookingRequest } from "@/concept/booking/request";
import { recentReviews, reviewSummary } from "@/concept/booking/reviews";
import { bookingShare } from "@/concept/booking/share";
import { createDemoState } from "@/concept/data/generate";
import { BRAND } from "@/concept/brand";

const today = "2026-11-17";
const state = createDemoState(today);
const at = { date: today, time: 540 };
const booking = state.bookings.find(booking => booking.status === "booked" && booking.date > today)!;
const send = { type: "booking-message/send", bookingId: booking.id, kind: "reminder", channel: "sms", at } as const;
const completed = state.bookings.find(booking => booking.status === "completed" && booking.date < today && !state.reviews.some(review => review.bookingId === booking.id))!;
const review = { type: "review/submit", bookingId: completed.id, rating: 5, text: "A calm, welcoming fictional visit.", at } as const;

describe("simulated booking messages", () => {
  it.each(["confirmation", "reminder"] as const)("previews %s from booking facts and links to management", kind => {
    const message = bookingMessage(state, booking, kind);
    expect(message.subject).toContain("Salong Eko");
    expect(message.body).toContain(state.services.find(service => service.id === booking.serviceId)!.name);
    expect(message.body).toContain(`/boka/salong-eko/booking/${booking.id}`);
  });
  it("logs one simulated message per kind/channel/time, without network calls", () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const sent = reduce(state, send);
    expect(sent.inbox[0]).toMatchObject({ bookingId: booking.id, handled: true, delivery: { channel: "sms", kind: "reminder" } });
    expect(messageWasSent(sent, booking, "reminder", "sms")).toBe(true);
    expect(reduce(sent, send)).toBe(sent);
    const email = reduce(sent, { ...send, channel: "email" });
    expect(email.inbox).toHaveLength(state.inbox.length + 2);
    const moved = { ...email, bookings: email.bookings.map(item => item.id === booking.id ? { ...item, date: "2026-12-01" } : item) };
    expect(reduce(moved, send).inbox).toHaveLength(state.inbox.length + 3);
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockRestore();
  });
  it("does not send for cancelled, completed, missing or already-started bookings", () => {
    expect(reduce(state, { ...send, bookingId: "missing" })).toBe(state);
    expect(reduce(state, { ...send, bookingId: completed.id })).toBe(state);
    const cancelled = { ...state, bookings: state.bookings.map(item => item.id === booking.id ? { ...item, status: "cancelled" as const } : item) };
    expect(reduce(cancelled, send)).toBe(cancelled);
    expect(reduce(state, { ...send, at: { date: booking.date, time: booking.start } })).toBe(state);
  });
});

describe("review moderation", () => {
  it("keeps a submitted review and rating private until approval; approval handles its Inbox entry", () => {
    const submitted = reduce(state, review);
    const pending = submitted.reviews[0];
    expect(pending).toMatchObject({ bookingId: completed.id, customerId: completed.customerId, approved: false, rating: 5, text: review.text });
    expect(submitted.inbox[0]).toMatchObject({ kind: "review", reviewId: pending.id, handled: false });
    expect(recentReviews(submitted.reviews, 1000)).not.toContainEqual(pending);
    expect(reviewSummary(submitted.reviews)).toEqual(reviewSummary(state.reviews));
    expect(reduce(submitted, review)).toBe(submitted);
    const approved = reduce(submitted, { type: "review/approve", id: pending.id });
    expect(recentReviews(approved.reviews, 1000)).toContainEqual({ ...pending, approved: true });
    expect(reviewSummary(approved.reviews).count).toBe(state.reviews.length + 1);
    expect(approved.inbox[0]).toMatchObject({ handled: true, read: true });
    expect(reduce(approved, { type: "review/approve", id: pending.id })).toBe(approved);
  });
  it.each([0, 6, 1.5, NaN])("rejects invalid rating %s", rating => expect(reduce(state, { ...review, rating })).toBe(state));
  it("rejects blank/overlong text, ineligible or missing visits and premature completed visits", () => {
    for (const text of [" ", "a".repeat(2001)]) expect(reduce(state, { ...review, text })).toBe(state);
    for (const bookingId of [booking.id, "missing"]) expect(reduce(state, { ...review, bookingId })).toBe(state);
    expect(reduce(state, { ...review, at: { date: "2020-01-01", time: 540 } })).toBe(state);
    expect(reduce(state, { ...review, at: { date: completed.date, time: completed.start } })).toBe(state);
    expect(reduce(state, { type: "review/approve", id: "missing" })).toBe(state);
  });
});

describe("customer phrase variants", () => {
  it.each([
    ["Can I get a sports massage after I finish work with Erik?", { serviceId: "deep-tissue", period: "evening", staffId: "erik" }],
    ["I'd like a back rub before lunch", { period: "morning" }],
    ["A 30-minute massage next available", { serviceId: "classic-30", soonest: true }],
    ["An hour-long massage after lunch", { serviceId: "classic-60", period: "afternoon" }],
    ["Footcare day after tomorrow with Anna", { from: "2026-11-19", to: "2026-11-19", staffId: "anna" }],
    ["Pedi on Fri around 3pm", { from: "2026-11-20", time: 900 }],
    ["Massage in two days before noon", { from: "2026-11-19", period: "morning" }],
    ["My tired feet need help when I finish work", { period: "evening" }],
    ["A firm massage on Thurs about 14:30", { serviceId: "deep-tissue", from: "2026-11-19", time: 870 }],
    ["Neck and shoulder massage on my way home", { period: "evening" }],
  ])("understands %s", (text, expected) => {
    const request = parseBookingRequest(text, state, today);
    expect(request).toMatchObject(expected);
    expect(request.serviceId).toBeDefined();
  });
  it("still asks the customer to choose when the treatment is unknown", () => expect(parseBookingRequest("Can I have a haircut tomorrow?", state, today).serviceId).toBeUndefined());
});

it("produces a clean bio link and iframe code with no customer or campaign parameters", () => {
  const share = bookingShare("https://demo.example/something?ref=private", "salong-eko", 'Salong "Eko" & <Co>');
  expect(share.link).toBe("https://demo.example/boka/salong-eko");
  expect(share.widget).toBe("https://demo.example/boka/salong-eko/widget");
  expect(share.code).toContain(`src="${share.widget}"`);
  // The business's name, escaped, never the platform's (#27).
  expect(share.code).toContain('title="Book with Salong &quot;Eko&quot; &amp; &lt;Co&gt;"');
  expect(share.code).not.toContain(BRAND.name);
  expect(share.code).not.toMatch(/ref=|private|something/);
  expect(() => bookingShare("javascript:alert(1)", "salong-eko", "Salong Eko")).toThrow();
});
