import { describe, expect, it } from "vitest";
import { interpretCommand, type IntentContext } from "../src/concept/intent";
import { parseDate, parseTime } from "../src/concept/intent/dates";

export const context: IntentContext = {
  now: "2026-11-17T09:00:00+01:00",
  customers: [{ id: "anna", name: "Anna Andersson" }, { id: "erik", name: "Erik Lind" }, { id: "lisa", name: "Lisa Berg" }],
  services: [{ id: "foot", name: "Foot care", durationMin: 60, priceSek: 600 }, { id: "massage", name: "Massage", durationMin: 45, priceSek: 800 }],
  staff: [{ id: "staff-anna", name: "Anna" }, { id: "staff-erik", name: "Erik" }],
  bookings: [{ id: "thursday", customerId: "anna", staffId: "staff-anna", serviceId: "foot", start: "2026-11-19T10:00:00+01:00" }, { id: "today", customerId: "erik", staffId: "staff-erik", serviceId: "massage", start: "2026-11-17T15:00:00+01:00" }, { id: "lisa-friday", customerId: "lisa", staffId: "staff-anna", serviceId: "foot", start: "2026-11-20T09:00:00+01:00" }],
};

describe("relative salon dates", () => {
  it.each([
    ["today", "2026-11-17"], ["tomorrow", "2026-11-18"], ["Monday", "2026-11-23"], ["Tuesday", "2026-11-17"],
    ["Wednesday", "2026-11-18"], ["Thursday", "2026-11-19"], ["Friday", "2026-11-20"], ["Saturday", "2026-11-21"], ["Sunday", "2026-11-22"],
    ["next Tuesday", "2026-11-24"], ["next Monday", "2026-11-23"], ["next week", "2026-11-23"], ["2027-01-05", "2027-01-05"], ["2026-02-30", undefined],
  ])("%s -> %s", (text, date) => expect(parseDate(text.toLowerCase(), context)).toBe(date));
  it("uses the salon date at UTC midnight boundaries", () => expect(parseDate("today", { ...context, now: "2026-11-17T23:30:00Z" })).toBe("2026-11-18"));
  it("crosses year boundaries", () => expect(parseDate("tomorrow", { ...context, now: "2026-12-31T12:00:00Z" })).toBe("2027-01-01"));
  it("crosses daylight saving without changing the calendar day", () => expect(parseDate("tomorrow", { ...context, now: "2026-03-28T12:00:00+01:00" })).toBe("2026-03-29"));
});

describe("English times", () => {
  it.each([
    ["2pm", "14:00"], ["2 pm", "14:00"], ["14:00", "14:00"], ["9am", "09:00"], ["12am", "00:00"], ["12pm", "12:00"], ["2:30pm", "14:30"],
    ["at 10", "10:00"], ["Friday 10", "10:00"], ["23:59", "23:59"], ["24:00", undefined], ["14:99", undefined], ["13pm", undefined], ["0am", undefined], ["morning", undefined],
  ])("%s -> %s", (text, time) => expect(parseTime(text.toLowerCase())).toBe(time));
});

describe("booking proposals", () => {
  it.each([
    "Book Erik for a foot treatment next Tuesday morning", "Book Erik for foot care tomorrow afternoon", "Book Erik for massage today at 2pm",
    "Schedule Erik for massage on Friday at 14:00", "Book Erik Lind for foot care tomorrow at 10", "Book Erki for massage tomorrow morning",
    "Book Erik for massag tomorrow afternoon", "Book Erik for foot care next week after work", "BOOK ERIK FOR MASSAGE TOMORROW MORNING",
  ])("understands %s", text => expect(interpretCommand(text, context)).toMatchObject({ action: "book", params: { customerId: "erik" } }));
  it("separates customer and staff", () => expect(interpretCommand("Book Erik for massage with Anna tomorrow morning", context)).toMatchObject({ action: "book", params: { customerId: "erik", staffId: "staff-anna" } }));
  it.each([
    ["Move Anna's appointment on Thursday to 14:00", "2026-11-19", "14:00", "thursday"],
    ["Move Anna’s appointment on Thursday to Friday 2pm", "2026-11-20", "14:00", "thursday"],
    ["move Lisa to Friday 10", "2026-11-20", "10:00", "lisa-friday"],
    ["Reschedule Anna on Thursday to tomorrow at 9am", "2026-11-18", "09:00", "thursday"],
  ])("%s", (text, date, time, bookingId) => expect(interpretCommand(text, context)).toMatchObject({ action: "move", params: { date, time, bookingId } }));
  it("cancels and offers to the waiting list", () => expect(interpretCommand("Cancel 15:00 today and offer the slot to the waiting list", context)).toMatchObject({ action: "cancel", params: { bookingId: "today", offerWaitingList: true } }));
  it("cancels without waiting list", () => expect(interpretCommand("Cancel Erik today", context)).toMatchObject({ action: "cancel", params: { offerWaitingList: false } }));
  it.each(["Book a massage tomorrow morning", "Book Erik tomorrow morning", "Book Erik for massage", "Book Erik for massage tomorrow", "Move Anna to Thursday", "Cancel Anna today", "Move someone to tomorrow at 14:00", "Book Erik for massage with Nobody tomorrow morning", "", "hello"]) ("asks about missing information: %s", text => expect(interpretCommand(text, context).action).toBe("question"));
  it("asks about duplicate first names", () => expect(interpretCommand("Book Anna for massage tomorrow morning", { ...context, customers: [...context.customers, { id: "other-anna", name: "Anna Berg" }] }).action).toBe("question"));
  it("asks about duplicate bookings", () => expect(interpretCommand("Cancel Erik today", { ...context, bookings: [...context.bookings, { ...context.bookings[1], id: "other", start: "2026-11-17T16:00:00+01:00" }] }).action).toBe("question"));
  it("does not mutate context", () => { const before = structuredClone(context); interpretCommand("Cancel Erik today", context); expect(context).toEqual(before); });
});

describe("business commands and questions", () => {
  it.each(["20% off massage all of March", "20 percent off massage in March", "Offer 20% discount on massage all March"])("campaign: %s", text => expect(interpretCommand(text, context)).toMatchObject({ action: "campaign", params: { serviceId: "massage", percentOff: 20, priceSek: 640, start: "2027-03-01", end: "2027-04-01" } }));
  it.each(["0% off massage", "101% off massage", "20% off unknown", "Make a campaign for massage"])("asks for campaign details: %s", text => expect(interpretCommand(text, context).action).toBe("question"));
  it.each(["Change massage price to 750", "Set massage price to 750 SEK", "Change massage price SEK 750"])("price: %s", text => expect(interpretCommand(text, context)).toMatchObject({ action: "change-price", params: { priceSek: 750 } }));
  it.each(["What have I earned this month?", "how much did I make this month", "Show revenue this month", "What is my income this month?"])("revenue: %s", text => expect(interpretCommand(text, context)).toMatchObject({ action: "revenue", params: { start: "2026-11-01", end: "2026-12-01" } }));
  it("last month", () => expect(interpretCommand("Show revenue last month", context)).toMatchObject({ params: { start: "2026-10-01", end: "2026-11-01" } }));
  it.each(["Which customers haven't been here since the summer?", "Which customers haven't been here since summer", "Which customers have not been here since summer?"])("inactive: %s", text => expect(interpretCommand(text, context)).toMatchObject({ action: "inactive-customers", params: { since: "2026-09-01" } }));
  it("three months inactive", () => expect(interpretCommand("Which customers have not been here in 3 months", context)).toMatchObject({ params: { since: "2026-08-17" } }));
  it.each(["Order more foot cream", "Buy foot cream", "Restock foot cream"])("stock: %s", text => expect(interpretCommand(text, context)).toMatchObject({ action: "order-stock", params: { product: "foot cream" } }));
  it.each(["Make a poster for Father's Day", "Create a poster for Christmas"])("poster: %s", text => expect(interpretCommand(text, context).action).toBe("make-poster"));
});
