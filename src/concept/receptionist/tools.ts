import { z } from "zod";
import { findCustomerByPhone } from "../booking/lookup";
import { earliestBookingStart, freeChangeOpen } from "../booking/policy";
import { PUBLIC_WINDOW_DAYS } from "../booking/public-projection";
import { addDays, diffDays, formatTime, toMinutes } from "../data/dates";
import { freeStarts, isFree, needOf, openingFor } from "../data/slots";
import type { Booking, DateKey, DemoState, Service, StaffId } from "../data/types";
import { formatDayLong } from "../i18n/format";
import { salonCopy } from "../i18n/salon-eko-copy";
import { bookableServices, findService, fullName } from "../selectors";
import { field } from "../tools/define";
import { plainText } from "./actions";
import type { ReceptionistHost, SalonView } from "./host";
import { callerPhone, salonDialing, spokenPhone } from "./phone";
import type { CallOutcome } from "./types";
import type { Locale } from "@/lib/locale";

// The receptionist's tools. Every one reads the salon through the host and
// changes it only through the ordinary booking actions, so a call can do
// nothing the studio's own rules refuse. Three rules are enforced here and not
// left to the model:
//
// - Nothing is booked, moved or cancelled before the caller has heard the
//   details read back: the first call of a write tool only returns the
//   read-back, and the change needs a second call with the same details.
// - A booking can be moved or cancelled only after `find_booking` matched the
//   caller's name and number to it in this call, and only while the change is
//   free of charge. Anything else is handed to the staff.
// - A caller learns nothing about other customers: `find_booking` answers
//   "not found" unless both name and number match.

/** What a call has established so far. One per call, kept by the call session. */
export interface CallMemory {
  callId: string;
  /** Fingerprint of the change last read back to the caller. */
  readBack?: string;
  /** Bookings the caller proved are theirs. */
  verified: Set<string>;
  outcome: CallOutcome;
  bookingId?: string;
  customerId?: string;
  handoverReason?: string;
  /** Set when the receptionist said goodbye and asked to hang up. */
  ended: boolean;
  /** Counts committed changes, for idempotency keys. */
  commits: number;
}

export const newCallMemory = (callId: string): CallMemory => ({ callId, verified: new Set(), outcome: "none", ended: false, commits: 0 });

const name = z.string().trim().min(2).max(80);
const phone = z.string().trim().min(7).max(24).describe("The phone number exactly as the caller said it, as a string with its leading 0 (or +46), e.g. \"070-987 65 43\".");
const PARTS = { morning: [0, 12 * 60], afternoon: [12 * 60, 17 * 60], evening: [17 * 60, 24 * 60] } as const;

const inputs = {
  get_salon_info: z.object({}).strict(),
  find_free_times: z.object({ serviceId: field.id, date: field.date, partOfDay: z.enum(["morning", "afternoon", "evening"]).optional(), staffId: field.id.optional() }).strict(),
  book_appointment: z.object({ serviceId: field.id, staffId: field.id, date: field.date, time: field.time, callerName: name, callerPhone: phone, confirmed: z.boolean() }).strict(),
  find_booking: z.object({ callerName: name, callerPhone: phone }).strict(),
  move_appointment: z.object({ bookingId: field.id, date: field.date, time: field.time, confirmed: z.boolean() }).strict(),
  cancel_appointment: z.object({ bookingId: field.id, confirmed: z.boolean() }).strict(),
  hand_over_to_staff: z.object({ reason: z.string().trim().min(3).max(300), callerName: name.optional(), callerPhone: phone, confirmed: z.boolean() }).strict(),
  end_call: z.object({}).strict(),
} as const;

export type ReceptionistToolName = keyof typeof inputs;

const descriptions: Record<ReceptionistToolName, string> = {
  get_salon_info: "The salon's address, phone, opening hours for the coming week, treatments with ids, prices and durations, and staff with ids. Call it before answering questions about the salon.",
  find_free_times: "Free start times for one treatment on one day. Offer the caller two of them. Never invent a time that is not in the result.",
  book_appointment: "Book a treatment. Call it first with confirmed=false: the result is the exact details to read back to the caller. Only after the caller has said yes to them, call it again with the same details and confirmed=true.",
  find_booking: "Look up the caller's upcoming bookings. Needs the name and the phone number the booking was made with. Required before moving or cancelling.",
  move_appointment: "Move one of the caller's bookings (found with find_booking) to a new day and time with the same staff member. First confirmed=false to get the read-back, then confirmed=true after the caller said yes.",
  cancel_appointment: "Cancel one of the caller's bookings (found with find_booking). First confirmed=false to get the read-back, then confirmed=true after the caller said yes.",
  hand_over_to_staff: "Leave a note for the staff to call the caller back; needs the caller's phone number (a call back needs a number, never an e-mail address). First confirmed=false: the result is the number to read back once; after the caller's yes, the same details with confirmed=true. Give a short neutral reason (\"Question about a gift card\"), never health details. Use it whenever you are unsure, the caller asks for a person, or a tool says a request needs the staff.",
  end_call: "Hang up. Call it only after you have said goodbye.",
};

/** Tools whose answers are read out, and so can be given in the language the call is in right now. */
const SPOKEN_TOOLS = new Set<ReceptionistToolName>(["get_salon_info", "find_free_times", "book_appointment", "find_booking", "move_appointment", "cancel_appointment"]);
const SPOKEN_LANGUAGE = { type: "string", enum: ["sv", "en"], description: "The language you are speaking with the caller right now, so names, days and numbers come back in it." };

/** The tools as a Realtime session declares them. */
export function receptionistToolSchemas() {
  return (Object.keys(inputs) as ReceptionistToolName[]).map((tool) => {
    const parameters = { ...(z.toJSONSchema(inputs[tool]) as Record<string, unknown>) };
    delete parameters.$schema;
    if (SPOKEN_TOOLS.has(tool)) {
      parameters.properties = { ...(parameters.properties as Record<string, unknown>), spokenLanguage: SPOKEN_LANGUAGE };
      parameters.required = [...((parameters.required as string[] | undefined) ?? []), "spokenLanguage"];
    }
    return { type: "function" as const, name: tool, description: descriptions[tool], parameters };
  });
}

export const isReceptionistTool = (tool: string): tool is ReceptionistToolName => Object.hasOwn(inputs, tool);

type Output = Record<string, unknown>;

const HANDOVER = "This needs the staff. Offer to leave a note with hand_over_to_staff.";
const refuse = (error: string, hint: string): Output => ({ ok: false, error, hint });

const language = (state: DemoState) => state.localization.language;

/** What the phone tools say about a number they cannot use, so she asks again instead of storing a wrong one. */
function checkPhone(state: DemoState, raw: string): { phone: string; refusal?: undefined } | { phone?: undefined; refusal: Output } {
  const checked = callerPhone(raw, salonDialing(state.salon.phone, state.localization.currency));
  if (checked.ok) return { phone: checked.phone };
  return { refusal: checked.reason === "missing_zero"
    ? refuse("phone_missing_zero", "Swedish numbers start with 0 (or +46), and this one does not. You probably missed the first digit. Ask once, short, if the number starts with noll, then read the whole number back digit by digit in groups.")
    : refuse("phone_unclear", "Ask the caller to say the phone number again, slowly, then read it back digit by digit in groups.") };
}

/**
 * The salon as it is spoken on a call in `spoken` (the call's language, else the salon's): the demo's stored
 * treatment and staff texts, days and numbers in that language. Only for what she says; ids and stored data are unchanged.
 */
export function spokenView(view: SalonView, spoken: Locale = language(view.state)): SalonView {
  const copy = salonCopy(view.state, spoken);
  // Roles stay as stored: the owner is found by them, and they are not read out.
  const staff = copy.staff.map((person) => ({ ...person, role: view.state.staff.find((stored) => stored.id === person.id)?.role ?? person.role }));
  return { ...view, state: { ...copy, staff, localization: { ...copy.localization, language: spoken } } };
}
const staffName = (state: DemoState, id: string) => state.staff.find((s) => s.id === id)?.firstName ?? id;
const dayText = (state: DemoState, date: DateKey) => formatDayLong(date, language(state));

function bookable(view: SalonView, date: string): date is DateKey {
  const { today } = view.clock;
  return date >= today && diffDays(date as DateKey, today) <= PUBLIC_WINDOW_DAYS;
}

/** First start a call may book on `date`: the booking page's lead time applies on the phone too. */
const earliest = (view: SalonView, date: DateKey) => (date === view.clock.today ? earliestBookingStart(date, view.clock.today, view.clock.minutes, view.instant) : 0);

function sameName(given: string, customer: { firstName: string; lastName: string }): boolean {
  const fold = (text: string) => text.toLocaleLowerCase("sv").normalize("NFKD").replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean);
  const said = new Set(fold(given));
  const first = fold(customer.firstName);
  const last = fold(customer.lastName);
  // The first name must be said, and the family name too when the card has one.
  return first.every((part) => said.has(part)) && (last.length === 0 || last.every((part) => said.has(part)));
}

/** What get_salon_info answers: today, hours for a week, treatments with ids and prices, staff. */
export function salonFacts(view: SalonView) {
  return salonInfo(view);
}

function salonInfo(view: SalonView) {
  const { state, clock } = view;
  const hours = Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(clock.today, offset);
    const open = openingFor(state.salon, date);
    return { date, day: dayText(state, date), open: open ? `${formatTime(open.open)}-${formatTime(open.close)}` : language(state) === "sv" ? "stängt" : "closed" };
  });
  return {
    ok: true,
    now: { date: clock.today, day: dayText(state, clock.today), time: formatTime(clock.minutes) },
    salon: { name: state.salon.name, address: state.salon.address, area: state.salon.area, phone: state.salon.phone },
    openingHours: hours,
    treatments: bookableServices(state).map((s) => ({ id: s.id, name: s.name, description: plainText(s.description, 160), minutes: s.duration, price: s.price, currency: state.localization.currency, staffIds: s.staffIds })),
    staff: state.staff.map((s) => ({ id: s.id, name: s.firstName, ...(s.role === "Owner" ? { owner: true } : {}) })),
    bookableDaysAhead: PUBLIC_WINDOW_DAYS,
  };
}

function service(state: DemoState, id: string): Service | undefined {
  return bookableServices(state).find((s) => s.id === id);
}

function freeTimes(view: SalonView, input: z.infer<typeof inputs.find_free_times>): Output {
  const { state } = view;
  const wanted = service(state, input.serviceId);
  if (!wanted) return refuse("unknown_treatment", "Use an id from get_salon_info.");
  if (!bookable(view, input.date)) return refuse("day_out_of_range", `Bookings can be made from today up to ${PUBLIC_WINDOW_DAYS} days ahead.`);
  const date = input.date;
  if (!openingFor(state.salon, date)) return { ok: true, date, day: dayText(state, date), open: false, times: [] };
  const [from, to] = input.partOfDay ? PARTS[input.partOfDay] : [0, 24 * 60];
  const after = Math.max(from, earliest(view, date));
  const staffIds = wanted.staffIds.filter((id) => !input.staffId || id === input.staffId);
  const times = staffIds
    .flatMap((staffId) => freeStarts(state, staffId, date, needOf(wanted), { after }).filter((start) => start < to).map((start) => ({ start, staffId })))
    .sort((a, b) => a.start - b.start || a.staffId.localeCompare(b.staffId))
    .slice(0, 8)
    .map(({ start, staffId }) => ({ time: formatTime(start), staffId, staff: staffName(state, staffId) }));
  return { ok: true, date, day: dayText(state, date), open: true, treatment: wanted.name, minutes: wanted.duration, price: wanted.price, times };
}

const fingerprint = (tool: string, input: Record<string, unknown>) => JSON.stringify([tool, ...Object.entries(input).filter(([key]) => key !== "confirmed").sort(([a], [b]) => a.localeCompare(b))]);

/** True when the caller has already heard exactly these details and said yes. Otherwise remembers them as read back. */
function confirmedBy(memory: CallMemory, tool: string, input: { confirmed: boolean } & Record<string, unknown>): boolean {
  const print = fingerprint(tool, input);
  if (input.confirmed && memory.readBack === print) return true;
  memory.readBack = print;
  return false;
}

const needsConfirmation = (readBack: Output): Output => ({
  ok: true,
  status: "needs_confirmation",
  readBack,
  next: "Read these details back to the caller and ask if they are right. Only when the caller says yes, call the same tool again with the same details and confirmed=true.",
});

async function book(host: ReceptionistHost, view: SalonView, memory: CallMemory, input: z.infer<typeof inputs.book_appointment>): Promise<Output> {
  const { state } = view;
  const wanted = service(state, input.serviceId);
  if (!wanted) return refuse("unknown_treatment", "Use an id from get_salon_info.");
  if (!wanted.staffIds.includes(input.staffId as StaffId)) return refuse("unknown_staff", "Use a staffId from find_free_times.");
  if (!bookable(view, input.date)) return refuse("day_out_of_range", `Bookings can be made from today up to ${PUBLIC_WINDOW_DAYS} days ahead.`);
  const callerName = plainText(input.callerName, 80);
  const { phone, refusal } = checkPhone(view.state, input.callerPhone);
  if (refusal) return refusal;
  const staffId = input.staffId as StaffId;
  const start = toMinutes(input.time);
  if (start < earliest(view, input.date) || !isFree(state, staffId, input.date, start, needOf(wanted))) {
    return refuse("time_taken", "That time is not free. Call find_free_times again and offer two other times.");
  }
  const details = { treatment: wanted.name, day: dayText(state, input.date), date: input.date, time: input.time, staff: staffName(state, staffId), name: callerName, phone, phoneSpoken: { sv: spokenPhone(phone, "sv"), en: spokenPhone(phone, "en") }, price: wanted.price };
  if (!confirmedBy(memory, "book_appointment", input)) return needsConfirmation(details);

  const known = findCustomerByPhone(state, phone);
  const committed = await host.commit(
    { type: "booking/create", serviceId: wanted.id, staffId, date: input.date, start, source: "phone", newCustomer: { name: callerName, phone, since: view.clock.today } },
    idempotencyKey(memory),
  );
  if (!committed.ok) return refuse("time_taken", "The time was taken just now. Call find_free_times again and offer two other times.");
  const before = new Set(state.bookings.map((b) => b.id));
  const booking = committed.state.bookings.find((b) => !before.has(b.id));
  memory.readBack = undefined;
  memory.outcome = "booked";
  memory.bookingId = booking?.id;
  memory.customerId = booking?.customerId ?? known?.id;
  if (booking) memory.verified.add(booking.id);
  return { ok: true, status: "booked", ...details, next: "Tell the caller the booking is made. No confirmation text or e-mail is sent, so do not promise one." };
}

function upcoming(view: SalonView, customerId: string): Booking[] {
  const { clock } = view;
  return view.state.bookings
    .filter((b) => b.customerId === customerId && b.status === "booked" && (b.date > clock.today || (b.date === clock.today && b.start > clock.minutes)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}

function bookingView(view: SalonView, booking: Booking): Output {
  const { state } = view;
  return {
    bookingId: booking.id,
    treatment: findService(state, booking.serviceId)?.name ?? "",
    day: dayText(state, booking.date),
    date: booking.date,
    time: formatTime(booking.start),
    staff: staffName(state, booking.staffId),
    canBeChangedByPhone: freeChangeOpen(booking, view.instant),
  };
}

function findBooking(view: SalonView, memory: CallMemory, input: z.infer<typeof inputs.find_booking>): Output {
  const customer = findCustomerByPhone(view.state, input.callerPhone);
  const notFound: Output = { ok: true, found: false, hint: "No booking matches that name and number. Ask once more, then offer to leave a note for the staff." };
  if (!customer || !sameName(input.callerName, customer)) return notFound;
  const bookings = upcoming(view, customer.id);
  if (bookings.length === 0) return notFound;
  for (const booking of bookings) memory.verified.add(booking.id);
  memory.customerId = customer.id;
  return { ok: true, found: true, name: fullName(customer), bookings: bookings.map((b) => bookingView(view, b)) };
}

/** The caller's own booking, when it may still be changed free of charge. */
function changeable(view: SalonView, memory: CallMemory, bookingId: string): { booking: Booking } | { refusal: Output } {
  const booking = view.state.bookings.find((b) => b.id === bookingId && b.status === "booked");
  if (!booking || !memory.verified.has(bookingId)) return { refusal: refuse("not_verified", "Call find_booking with the caller's name and number first.") };
  if (!freeChangeOpen(booking, view.instant)) return { refusal: refuse("needs_staff", `It is too close to the visit to change it by phone. ${HANDOVER}`) };
  return { booking };
}

async function move(host: ReceptionistHost, view: SalonView, memory: CallMemory, input: z.infer<typeof inputs.move_appointment>): Promise<Output> {
  const found = changeable(view, memory, input.bookingId);
  if ("refusal" in found) return found.refusal;
  const { booking } = found;
  const { state } = view;
  if (!bookable(view, input.date)) return refuse("day_out_of_range", `Bookings can be made from today up to ${PUBLIC_WINDOW_DAYS} days ahead.`);
  const start = toMinutes(input.time);
  if (start < earliest(view, input.date) || !isFree(state, booking.staffId, input.date, start, booking, booking.id)) {
    return refuse("time_taken", "That time is not free. Call find_free_times again and offer two other times.");
  }
  const details = { treatment: findService(state, booking.serviceId)?.name ?? "", from: { day: dayText(state, booking.date), time: formatTime(booking.start) }, to: { day: dayText(state, input.date), date: input.date, time: input.time }, staff: staffName(state, booking.staffId) };
  if (!confirmedBy(memory, "move_appointment", input)) return needsConfirmation(details);
  const committed = await host.commit({ type: "booking/move", id: booking.id, date: input.date, start }, idempotencyKey(memory));
  if (!committed.ok) return refuse("time_taken", "The time was taken just now. Call find_free_times again and offer two other times.");
  memory.readBack = undefined;
  memory.outcome = "moved";
  memory.bookingId = booking.id;
  return { ok: true, status: "moved", ...details };
}

async function cancel(host: ReceptionistHost, view: SalonView, memory: CallMemory, input: z.infer<typeof inputs.cancel_appointment>): Promise<Output> {
  const found = changeable(view, memory, input.bookingId);
  if ("refusal" in found) return found.refusal;
  const { booking } = found;
  const details = bookingView(view, booking);
  if (!confirmedBy(memory, "cancel_appointment", input)) return needsConfirmation(details);
  const committed = await host.commit({ type: "booking/cancel", id: booking.id }, idempotencyKey(memory));
  if (!committed.ok) return refuse("needs_staff", `The booking could not be cancelled. ${HANDOVER}`);
  memory.readBack = undefined;
  memory.outcome = "cancelled";
  memory.bookingId = booking.id;
  return { ok: true, status: "cancelled", ...details };
}

async function handOver(host: ReceptionistHost, view: SalonView, memory: CallMemory, input: z.infer<typeof inputs.hand_over_to_staff>, text: HandoverText): Promise<Output> {
  const reason = plainText(input.reason, 300);
  const caller = input.callerName ? plainText(input.callerName, 80) : undefined;
  // A call back needs a number the staff can call; an e-mail address cannot be called.
  const { phone, refusal } = checkPhone(view.state, input.callerPhone);
  if (refusal) return refusal;
  // The staff can only call back on the right number: the caller hears it once and says yes first.
  if (!confirmedBy(memory, "hand_over_to_staff", input)) return needsConfirmation({ phone, phoneSpoken: { sv: spokenPhone(phone, "sv"), en: spokenPhone(phone, "en") } });
  const body = text.body({ reason, caller, phone });
  const committed = await host.commit(
    { type: "inbox/add", item: { kind: "message", fromName: caller, date: view.clock.today, time: view.clock.minutes, title: text.title, body, read: false, handled: false } },
    idempotencyKey(memory),
  );
  if (!committed.ok) return refuse("note_failed", "The note could not be saved. Ask the caller to call again during opening hours.");
  // A booking made earlier in the call stays the call's outcome.
  memory.readBack = undefined;
  if (memory.outcome === "none") memory.outcome = "handover";
  memory.handoverReason = reason;
  return { ok: true, status: "note_left", next: "Tell the caller the staff will call back. Do not promise a time." };
}

/** One key per committed change of a call, so a retried tool call cannot book twice. */
function idempotencyKey(memory: CallMemory): string {
  memory.commits += 1;
  return `${memory.callId}-${memory.commits}`;
}

/** The inbox note of a handover, worded by the caller of the engine from the dictionary in the salon's language. */
export interface HandoverText {
  title: string;
  /** `email` is never passed any more (a call back needs a phone number); kept so older formatters still fit. */
  body: (input: { reason: string; caller?: string; phone?: string; email?: string }) => string;
}

export interface ToolRun {
  host: ReceptionistHost;
  memory: CallMemory;
  handover: HandoverText;
  /** The language of the call, for treatment names, days and numbers; the salon's when left out. */
  language?: Locale;
}

/**
 * Runs one tool call and returns what the model is told. Never throws: bad
 * arguments, an unknown tool and a salon that cannot be read all come back as
 * a refusal the model can act on.
 */
export async function runReceptionistTool(run: ToolRun, tool: string, rawArguments: string): Promise<Output> {
  if (!isReceptionistTool(tool)) return refuse("unknown_tool", HANDOVER);
  let json: unknown;
  try {
    json = JSON.parse(rawArguments || "{}");
  } catch {
    return refuse("invalid_arguments", "Send the arguments as one JSON object.");
  }
  // The call's current language is not part of what is booked: taken off before the tool's own arguments are checked.
  let spoken = run.language;
  if (SPOKEN_TOOLS.has(tool) && json && typeof json === "object" && !Array.isArray(json) && "spokenLanguage" in json) {
    const { spokenLanguage, ...rest } = json as Record<string, unknown>;
    if (spokenLanguage === "sv" || spokenLanguage === "en") spoken = spokenLanguage;
    json = rest;
  }
  const parsed = inputs[tool].safeParse(json);
  if (!parsed.success) return refuse("invalid_arguments", parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ").slice(0, 300));
  const stored = await run.host.read();
  const view = stored && spokenView(stored, spoken);
  if (!view) return refuse("salon_unavailable", "The calendar cannot be reached. Apologise and ask the caller to call again later.");
  const { host, memory } = run;
  switch (tool) {
    case "get_salon_info":
      return salonInfo(view);
    case "find_free_times":
      return freeTimes(view, parsed.data as z.infer<typeof inputs.find_free_times>);
    case "book_appointment":
      return book(host, view, memory, parsed.data as z.infer<typeof inputs.book_appointment>);
    case "find_booking":
      return findBooking(view, memory, parsed.data as z.infer<typeof inputs.find_booking>);
    case "move_appointment":
      return move(host, view, memory, parsed.data as z.infer<typeof inputs.move_appointment>);
    case "cancel_appointment":
      return cancel(host, view, memory, parsed.data as z.infer<typeof inputs.cancel_appointment>);
    case "hand_over_to_staff":
      return handOver(host, view, memory, parsed.data as z.infer<typeof inputs.hand_over_to_staff>, run.handover);
    case "end_call":
      memory.ended = true;
      return { ok: true };
  }
}
