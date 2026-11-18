import { DateTime } from "luxon";
import { clock, dateRange, parseDate, parseTime } from "./dates";
import { matchNames } from "./match";
import { interpretSchedule } from "./schedule";
import type { IntentAction, IntentContext, IntentParams, IntentResult } from "./types";
export type { IntentAction, IntentContext, IntentParams, IntentResult } from "./types";

const QUANTITY_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3 };

export function interpretCommand(input: string, context: IntentContext): IntentResult {
  const text = input.toLowerCase().replace(/’/g, "'").trim();
  const params: IntentParams = {};
  const question = (message: string): IntentResult => ({ action: "question", params, summary: message, question: message, confidence: 0 });
  const proposal = (action: IntentAction, summary: string): IntentResult => ({ action, params, summary, confidence: 0.9 });
  clock(context);
  if (!text) return question("What would you like to do?");
  const schedule = interpretSchedule(text, context);
  if (schedule) return schedule;
  const sold = text.match(/\b(?:sold|sell)\s+(?:(\d+|an?|one|two|three)\s+)?(.+?)\s+to\s+(.+?)[.!?]*$/);
  if (sold) {
    params.product = sold[2];
    params.quantity = QUANTITY_WORDS[sold[1] ?? "a"] ?? Number(sold[1]);
    const buyers = matchNames(sold[3], context.customers);
    if (buyers.length > 1) return question("Which customer do you mean? Please use their full name.");
    if (!buyers.length) return question("Who bought it? Please give the customer's name.");
    params.customerId = buyers[0].id;
    return proposal("sell-product", `Propose selling ${params.quantity} ${params.product} to ${buyers[0].name}.`);
  }
  const left = text.match(/\bhow (?:much|many)\s+(.+?)(?:\s+(?:is|are|do i have|have i got))?\s+(?:left|remaining|in stock)\b/) ?? text.match(/\bdo i have (?:any |enough )?(.+?)(?:\s+(?:left|in stock))?[.!?]*$/);
  if (left) {
    params.product = left[1];
    return proposal("stock-level", `Show how much ${params.product} is left.`);
  }
  if (/\b(earn|earned|earnings|revenue|income|takings|how much.*make|how much.*made)\b/.test(text)) {
    Object.assign(params, dateRange(text, context));
    return proposal("revenue", `Show revenue from ${params.start} to ${params.end} (exclusive).`);
  }
  if (/customers?.*(haven't|have not|not been|since|inactive)/.test(text)) {
    const now = clock(context);
    const months = text.match(/(\d+)\s+months?/);
    params.since = /summer/.test(text) ? now.set({ year: now.month >= 9 ? now.year : now.year - 1, month: 9, day: 1 }).toISODate()! : months ? now.minus({ months: Number(months[1]) }).toISODate()! : parseDate(text, context);
    if (!params.since) return question("Since what date should I look for inactive customers?");
    return proposal("inactive-customers", `Find customers with no visits since ${params.since}.`);
  }
  if (/\b(order|buy|restock)\b/.test(text)) {
    params.product = text.replace(/^.*?\b(order|buy|restock)\s+(more\s+)?/, "").replace(/[.!?]+$/, "").trim();
    return params.product ? proposal("order-stock", `Draft an order for ${params.product}.`) : question("Which product should I order?");
  }
  if (/\bposter\b/.test(text)) {
    params.occasion = text.replace(/^.*?poster\s*(for\s*)?/, "").replace(/[.!?]+$/, "").trim();
    return params.occasion ? proposal("make-poster", `Propose a poster for ${params.occasion}.`) : question("What should the poster promote?");
  }
  const services = matchNames(text.replace(/foot treatment/g, "foot care"), context.services);
  const price = text.match(/(?:\b(?:sek|price)\s*(\d+(?:\.\d+)?)\b|\b(\d+(?:\.\d+)?)\s*(?:sek|kr)\b|\b(?:price|cost).*?\bto\s+(\d+(?:\.\d+)?))/);
  const discount = text.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:off|discount)?/);
  if (discount || /\b(campaign|offer)\b/.test(text) && !/cancel/.test(text) || /\b(price|cost)\b/.test(text) || price && /\b(set|change|update)\b/.test(text)) {
    if (services.length !== 1) return question("Which service should the offer or price apply to?");
    params.serviceId = services[0].id;
    if (discount) {
      params.percentOff = Number(discount[1]);
      if (params.percentOff <= 0 || params.percentOff > 100) return question("What discount between 1 and 100 percent should I use?");
      params.priceSek = Math.round(services[0].priceSek * (1 - params.percentOff / 100) * 100) / 100;
      Object.assign(params, dateRange(text, context));
      return proposal("campaign", `Propose ${params.percentOff}% off ${services[0].name}: ${params.priceSek} SEK.`);
    }
    if (price) {
      params.priceSek = Number(price[1] ?? price[2] ?? price[3]);
      return proposal("change-price", `Propose ${services[0].name} at ${params.priceSek} SEK.`);
    }
    return question("What discount or price should I use?");
  }
  const action = /\b(move|reschedule|rebook)\b/.test(text) ? "move" : /\b(cancel|delete)\b/.test(text) ? "cancel" : /\b(book|schedule|appointment)\b/.test(text) ? "book" : undefined;
  if (!action) return question("Could you describe a booking, campaign, stock order or revenue question?");
  const customerText = text.split(/\b(?:for a|with|on|to|today|tomorrow|next)\b/)[0];
  const customers = matchNames(customerText, context.customers);
  if (customers.length > 1) return question("Which customer do you mean? Please use their full name.");
  if (customers.length === 1) params.customerId = customers[0].id;
  const staffText = text.match(/\bwith\s+(.+?)(?:\bon\b|\bat\b|\btomorrow\b|\btoday\b|\bnext\b|$)/)?.[1];
  if (staffText) {
    const staff = matchNames(staffText, context.staff);
    if (staff.length !== 1) return question("Which staff member do you mean?");
    params.staffId = staff[0].id;
  }
  const halves = action === "move" ? text.split(/\bto\b/) : [text];
  const target = halves.length > 1 ? halves.slice(1).join(" to ") : text;
  params.date = parseDate(target, context) ?? (action === "move" ? parseDate(halves[0], context) : undefined);
  params.time = parseTime(target);
  if (/morning/.test(target)) params.period = "morning";
  if (/afternoon|after work/.test(target)) params.period = "afternoon";
  if (action === "book") {
    if (!params.customerId) return question("Who should I book? Please give the customer's name.");
    if (services.length !== 1) return question("Which treatment should I book?");
    params.serviceId = services[0].id;
    if (!params.date) return question("Which day should I book?");
    if (!params.time && !params.period) return question("What time or part of the day suits you?");
    return proposal("book", `Propose ${services[0].name} for ${customers[0].name} on ${params.date} ${params.time ?? params.period}.`);
  }
  const sourceDate = parseDate(halves[0], context);
  const sourceTime = parseTime(halves[0]);
  const bookings = context.bookings.filter(booking => {
    const start = DateTime.fromISO(booking.start, { zone: context.timezone ?? "Europe/Stockholm" });
    return (!params.customerId || booking.customerId === params.customerId) && (!sourceDate || start.toISODate() === sourceDate) && (!sourceTime || start.toFormat("HH:mm") === sourceTime) && (!params.staffId || booking.staffId === params.staffId) && (params.customerId || sourceDate || sourceTime);
  });
  if (bookings.length !== 1) return question(bookings.length ? "Which appointment do you mean? Please add a day or time." : "I could not find that appointment. Which customer, day and time?");
  params.bookingId = bookings[0].id;
  if (action === "cancel") {
    params.offerWaitingList = /waiting list|waitlist/.test(text);
    return proposal("cancel", `Propose cancelling appointment ${params.bookingId}${params.offerWaitingList ? " and offering the slot to the waiting list" : ""}.`);
  }
  if (!params.date || !params.time) return question("What day and time should I move the appointment to?");
  return proposal("move", `Propose moving appointment ${params.bookingId} to ${params.date} ${params.time}.`);
}
