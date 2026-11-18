import type { Proposal } from "../command/proposal";
import { pickCandidates } from "../command/proposal";
import { buildIntentContext } from "../command/intent-context";
import { dueBackList } from "../customers/return-visits";
import { addDays, formatTime } from "../data/dates";
import { freeStarts, needOf } from "../data/slots";
import type { Booking, Customer, DateKey, DemoState, Service, StaffId } from "../data/types";
import type { Clock } from "../finance/types";
import { t, tc } from "../i18n";
import { agoText, formatDayLong, formatDuration, formatMoney, relativeDay } from "../i18n/format";
import { balanceOf, findGiftCard } from "../giftcards/cards";
import { parseDate, parseTime } from "../intent/dates";
import { matchNames, normalize } from "../intent/match";
import { canOpen, servedBy, type Role } from "../ops/access";
import { buildCustomerStats, findCustomer, findService, fullName } from "../selectors";
import type { ReplyCard, ThreadContext } from "./thread";

// Read questions an owner asks every day, answered straight from the data:
// who is next, when someone is coming, what they had last time, whether a
// treatment fits, what something costs, what is waiting. Nothing here changes
// anything, and a question the rules cannot answer exactly gets an honest
// "I cannot do that here" with the place to do it, never a guess.
//
// The studio's role policy applies before any lookup: a staff member gets
// only what the staff view would show (`canOpen` for the page an answer links
// to, and only the customers they serve, with their own bookings).

export interface LookupInput {
  state: DemoState;
  clock: Clock;
  context: ThreadContext;
  /** Staff only see their own bookings. */
  viewer?: StaffId;
  owner: boolean;
}

export interface Lookup {
  text: string;
  card?: ReplyCard;
  followUps?: string[];
  topic?: string;
  context?: Partial<ThreadContext>;
}

const MAX_ROWS = 8;
const role = (input: LookupInput): Role => (input.owner ? "owner" : "staff");
const ownerOnly = (): Lookup => ({ text: t("command.ownerOnly") });
const notServed = (): Lookup => ({ text: t("assistant.lookup.notServed") });

/** The customers this viewer may see: everyone for the owner, the ones they serve for staff (the customer page's own rule). */
function visible(input: LookupInput): (id: string) => boolean {
  if (input.owner) return () => true;
  const served = input.viewer ? servedBy(input.state, input.viewer) : new Set<string>();
  return (id) => served.has(id);
}

/** The bookings this viewer may see: all for the owner, their own for staff. */
const mine = (input: LookupInput) => (b: Booking) => input.owner || (!!input.viewer && b.staffId === input.viewer);
const SEARCH_DAYS = 21;

const customerHref = (id: string) => `/studio/customers/${id}`;
const message = (text: string, link?: { href: string; label: string }): Lookup => ({ text, card: link ? { kind: "message", text, link } : undefined });
const staffName = (state: DemoState, id: StaffId) => state.staff.find((s) => s.id === id)?.firstName ?? id;
const dayText = (date: DateKey, today: DateKey) => relativeDay(date, today);

function bookingRow(state: DemoState, booking: Booking, withDay?: DateKey) {
  const customer = findCustomer(state, booking.customerId);
  return {
    id: booking.id,
    time: formatTime(booking.start),
    name: customer ? fullName(customer) : "",
    detail: [withDay ? dayText(booking.date, withDay) : null, findService(state, booking.serviceId)?.name, staffName(state, booking.staffId)].filter(Boolean).join(" · "),
    href: customerHref(booking.customerId),
  };
}

/**
 * The one customer the words name, the candidates when several fit, or nothing. Falls back on who the conversation is about.
 * `denied` when the words name only customers this viewer may not see.
 */
function namedCustomer(input: LookupInput, text: string): { customer?: Customer; several?: Customer[]; denied?: true } {
  const found = anyNamedCustomer(input, text);
  const may = visible(input);
  if (found.customer) return may(found.customer.id) ? found : { denied: true };
  if (found.several) {
    const allowed = found.several.filter((c) => may(c.id));
    if (!allowed.length) return { denied: true };
    return allowed.length === 1 ? { customer: allowed[0] } : { several: allowed };
  }
  return found;
}

function anyNamedCustomer(input: LookupInput, text: string): { customer?: Customer; several?: Customer[] } {
  const words = normalize(text).split(" ");
  const said = (name: string) => normalize(name).split(" ").some((part) => words.includes(part) || words.includes(`${part}s`));
  // A near miss ("Anna" for Hanna) does not count when the word is a colleague's name.
  const colleague = input.state.staff.some((s) => said(s.firstName));
  const matches = matchNames(text, input.state.customers.map((c) => ({ id: c.id, name: fullName(c) }))).filter((m) => !colleague || said(m.name));
  const byId = (id: string) => input.state.customers.find((c) => c.id === id)!;
  if (matches.length === 1) return { customer: byId(matches[0].id) };
  if (matches.length > 1) return { several: matches.slice(0, 6).map((m) => byId(m.id)) };
  return !colleague && input.context.customerIds.length === 1 ? { customer: findCustomer(input.state, input.context.customerIds[0]) } : {};
}

/** Ask which person, with each full name as a tappable answer that repeats the question. */
function whichCustomer(text: string, several: Customer[]): Lookup {
  const first = several[0].firstName;
  const title = t("assistant.lookup.which", { name: first });
  const choices = several.map((c) => ({ label: fullName(c), text: text.replace(new RegExp(`\\b${first}\\b(?:'s)?`, "i"), (word) => fullName(c) + (/'s$/i.test(word) ? "'s" : "")) }));
  return { text: title, card: { kind: "choose", title, choices } };
}

function nextClient(input: LookupInput): Lookup {
  const { state, clock } = input;
  const left = state.bookings
    .filter((b) => b.status === "booked" && b.date === clock.today && b.start + b.duration > clock.minutes && (!input.viewer || b.staffId === input.viewer))
    .sort((a, b) => a.start - b.start);
  const next = left.find((b) => b.start > clock.minutes);
  const now = left.filter((b) => b.start <= clock.minutes);
  if (!left.length) return message(t("assistant.lookup.noneLeft"), { href: "/studio/calendar", label: t("nav.calendar") });
  const say = (key: "assistant.lookup.now" | "assistant.lookup.next", b: Booking) => t(key, { time: formatTime(b.start), name: fullName(findCustomer(state, b.customerId) ?? { firstName: "", lastName: "" }) });
  const text = [...now.map((b) => say("assistant.lookup.now", b)), next ? say("assistant.lookup.next", next) : t("assistant.lookup.noneAfter")].join(" ");
  const shown = [...now, ...(next ? [next] : [])];
  return { text, card: { kind: "bookings", title: text, items: shown.map((b) => bookingRow(state, b)) }, context: { customerIds: [(next ?? shown[0]).customerId], date: clock.today } };
}

function nextAppointment(input: LookupInput, text: string): Lookup | null {
  const { customer, several, denied } = namedCustomer(input, text);
  if (denied) return notServed();
  if (several) return whichCustomer(text, several);
  if (!customer) return null;
  const { state, clock } = input;
  const upcoming = state.bookings
    .filter(mine(input))
    .filter((b) => b.customerId === customer.id && b.status === "booked" && (b.date > clock.today || (b.date === clock.today && b.start + b.duration > clock.minutes)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const context = { customerIds: [customer.id] };
  if (!upcoming.length) {
    const text = t("assistant.lookup.nothingBooked", { name: fullName(customer) });
    return { text, card: { kind: "message", text, link: { href: customerHref(customer.id), label: t("assistant.lookup.openCustomer", { name: customer.firstName }) } }, context };
  }
  const [first] = upcoming;
  const title = t("assistant.lookup.nextAppointment", { name: fullName(customer), day: formatDayLong(first.date), time: formatTime(first.start) });
  return { text: title, card: { kind: "bookings", title, items: upcoming.slice(0, 3).map((b) => bookingRow(state, b, clock.today)) }, context: { ...context, date: first.date } };
}

function lastVisit(input: LookupInput, text: string): Lookup | null {
  const { customer, several, denied } = namedCustomer(input, text);
  if (denied) return notServed();
  if (several) return whichCustomer(text, several);
  if (!customer) return null;
  const { state, clock } = input;
  const last = state.bookings
    .filter(mine(input))
    .filter((b) => b.customerId === customer.id && b.status === "completed")
    .sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start)[0];
  const link = { href: customerHref(customer.id), label: t("assistant.lookup.openCustomer", { name: customer.firstName }) };
  const context = { customerIds: [customer.id] };
  if (!last) {
    const text = t("assistant.lookup.noVisit", { name: fullName(customer) });
    return { text, card: { kind: "message", text, link }, context };
  }
  // The treatment notes stay in the journal; the assistant says which visit it was and takes the owner there.
  const answer = t("assistant.lookup.lastVisit", {
    name: fullName(customer),
    service: findService(state, last.serviceId)?.name ?? "",
    staff: staffName(state, last.staffId),
    day: formatDayLong(last.date),
    ago: agoText(last.date, clock.today),
  });
  return { text: answer, card: { kind: "message", text: answer, link }, context: { ...context, serviceId: last.serviceId } };
}

/** The service the words name; a stated length ("60-minute massage") settles it when several fit. */
function namedServices(state: DemoState, text: string): Service[] {
  const matches = matchNames(text, state.services.map((s) => ({ id: s.id, name: s.name })));
  const found = matches.map((m) => state.services.find((s) => s.id === m.id)!);
  const minutes = text.match(/\b(\d{2,3})[\s-]*(?:min|minutes?)\b/);
  const hours = text.match(/\b(?:an?|one|1)[\s-]hour\b/);
  const length = minutes ? Number(minutes[1]) : hours ? 60 : undefined;
  if (found.length === 1 || length === undefined) return found;
  const pool = found.length ? found : state.services.filter((s) => text.includes(s.category));
  const fitting = pool.filter((s) => s.duration === length);
  return fitting.length ? fitting : found;
}

function availability(input: LookupInput, text: string, question: string): Lookup {
  const { state, clock } = input;
  const services = namedServices(state, text);
  if (services.length !== 1) {
    const title = t("assistant.lookup.whichService");
    const pool = services.length ? services : state.services;
    return { text: title, card: { kind: "choose", title, choices: pool.slice(0, 8).map((s) => ({ label: s.name, text: t("assistant.lookup.availabilityFor", { service: s.name, rest: whenWords(text) }) })) } };
  }
  const [service] = services;
  const intent = buildIntentContext(state, clock.today, clock.minutes);
  const asked = parseDate(text, intent) ?? clock.today;
  if (asked < clock.today) return message(t("command.dayPassed", { day: formatDayLong(asked) }));
  const period = /morning/.test(text) ? "morning" : /afternoon|after lunch|after work/.test(text) ? "afternoon" : undefined;
  // A clock time only ("16:00", "4pm", "at 16"), never a length ("60-minute") or a date ("Friday 20 November").
  const timeWords = text.replace(/\b\d{2,3}[\s-]*(?:min|minutes?)\b/g, "").replace(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/g, "");
  const at = /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*(?:am|pm)\b|\bat\s+\d{1,2}\b/.test(timeWords) ? parseTime(timeWords) : undefined;
  const wanted = at ? Number(at.slice(0, 2)) * 60 + Number(at.slice(3)) : undefined;
  const staff = matchNames(text, state.staff.map((s) => ({ id: s.id, name: s.firstName })));
  const staffIds = service.staffIds.filter((id) => staff.length !== 1 || id === staff[0].id);
  const calendar = { href: "/studio/calendar", label: t("nav.calendar") };
  const slotText = (c: { staffId: StaffId; start: number }) => (staffIds.length > 1 ? t("command.slotWith", { time: formatTime(c.start), name: staffName(state, c.staffId) }) : formatTime(c.start));

  // A stated time is checked first, exactly; anything else offered is labelled an alternative.
  let exact: { staffId: StaffId; start: number }[] = [];
  if (wanted !== undefined) {
    const after = asked === clock.today ? clock.minutes : 0;
    exact = staffIds.filter((id) => freeStarts(state, id, asked, needOf(service), { after }).includes(wanted)).map((staffId) => ({ staffId, start: wanted }));
  }
  const starts = (date: DateKey) => pickCandidates(state, staffIds, needOf(service), date, clock, { period, near: date === asked ? wanted : undefined });
  let date = asked;
  let found = exact.length ? exact : starts(date);
  for (let i = 1; !found.length && i <= SEARCH_DAYS; i++) {
    date = addDays(asked, i);
    found = starts(date);
  }
  if (!found.length) return message(t("assistant.lookup.noRoom", { service: service.name, day: formatDayLong(asked) }), calendar);
  const times = found.map(slotText);
  let answer: string;
  if (exact.length) answer = `${t("assistant.lookup.roomAt", { service: service.name, duration: formatDuration(service.duration), day: formatDayLong(asked), time: formatTime(wanted!) })}${staffIds.length > 1 ? ` (${exact.map((c) => staffName(state, c.staffId)).join(", ")})` : ""}.`;
  else if (wanted !== undefined) answer = `${t("assistant.lookup.notAt", { service: service.name, day: formatDayLong(asked), time: formatTime(wanted) })} ${t("assistant.lookup.alternatives", { day: formatDayLong(date) })} ${times.join(", ")}.`;
  else {
    const lead = date === asked
      ? t("assistant.lookup.room", { service: service.name, duration: formatDuration(service.duration), day: formatDayLong(date) })
      : t("assistant.lookup.roomLater", { service: service.name, asked: formatDayLong(asked), day: formatDayLong(date) });
    answer = `${lead} ${times.join(", ")}.`;
  }
  const context = { serviceId: service.id, date };
  // With one customer in the conversation, each time is a tap away from a booking proposal.
  const customer = input.owner && input.context.customerIds.length === 1 ? findCustomer(state, input.context.customerIds[0]) : undefined;
  if (!customer) return { text: answer, card: { kind: "message", text: answer, link: calendar }, context, topic: question };
  const choices = found.map((c) => ({
    label: t("assistant.lookup.bookAt", { name: customer.firstName, time: formatTime(c.start) }),
    text: `Book ${fullName(customer)} for ${service.name} on ${date} at ${formatTime(c.start)} with ${staffName(state, c.staffId)}`,
  }));
  return { text: answer, card: { kind: "choose", title: answer, choices }, context, topic: question };
}

/** The day and part of the day from the question, to repeat it for another service. */
function whenWords(text: string): string {
  const day = text.match(/\b(today|tomorrow|(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{4}-\d{2}-\d{2})\b/)?.[0] ?? "today";
  const part = text.match(/\b(morning|afternoon)\b/)?.[0];
  return part ? `${day} ${part}` : day;
}

function servicePrice(input: LookupInput, text: string): Lookup | null {
  const services = namedServices(input.state, text);
  if (!services.length) return null;
  const line = (s: Service) => t("assistant.lookup.price", { service: s.name, duration: formatDuration(s.duration), price: formatMoney(s.price) });
  const answer = services.slice(0, 4).map(line).join(" ");
  return { text: answer, card: { kind: "message", text: answer, link: { href: "/studio/more/services", label: t("nav.services") } }, context: services.length === 1 ? { serviceId: services[0].id } : undefined };
}

function giftCard(input: LookupInput, text: string): Lookup {
  const link = { href: "/studio/more/giftcards", label: t("nav.giftcards") };
  const code = text.match(/\b[a-z]{2,4}(?:-[a-z0-9]{3,5}){1,3}\b/i)?.[0].toUpperCase();
  if (!code) return message(t("assistant.lookup.giftCode"), link);
  // The same lookup and balance as the booking page and the Gift cards page: a cancelled booking gives its money back.
  const card = findGiftCard(input.state, code);
  if (!card) return message(t("assistant.lookup.giftUnknown", { code }), link);
  return message(t("assistant.lookup.giftBalance", { code: card.code, left: formatMoney(balanceOf(input.state, card)), amount: formatMoney(card.amount) }), link);
}

function inbox(input: LookupInput): Lookup {
  const { state, clock } = input;
  const link = { href: "/studio/inbox", label: t("nav.inbox") };
  const waiting = state.inbox.filter((i) => !i.handled && (i.kind === "request" || i.kind === "reschedule")).sort((a, b) => b.date.localeCompare(a.date) || b.time - a.time);
  if (!waiting.length) return message(t("assistant.lookup.inboxEmpty"), link);
  const title = tc("assistant.lookup.inbox", waiting.length);
  const items = waiting.slice(0, MAX_ROWS).map((i) => ({
    id: i.id,
    time: formatTime(i.time),
    name: (i.customerId ? fullName(findCustomer(state, i.customerId) ?? { firstName: i.fromName ?? "", lastName: "" }) : i.fromName ?? "").trim() || i.title,
    detail: `${dayText(i.date, clock.today)} · ${i.title}`,
    href: link.href,
  }));
  return { text: title, card: { kind: "bookings", title, items, link } };
}

function dueBack(input: LookupInput, text: string): Lookup {
  const { state, clock } = input;
  const link = { href: "/studio/customers/due-back", label: t("assistant.lookup.dueBackOpen") };
  const services = namedServices(state, text);
  const category = state.services.map((s) => s.category).find((c) => text.includes(c));
  const all = dueBackList(state, buildCustomerStats(state, clock.today), clock.today);
  const rows = all.filter((row) => (services.length ? services.some((s) => s.id === row.service.id) : !category || row.service.category === category));
  if (!rows.length) return message(t("assistant.lookup.dueBackNone"), link);
  const title = tc("assistant.lookup.dueBack", rows.length);
  const card: Proposal = {
    kind: "customers",
    title,
    total: rows.length,
    items: rows.slice(0, MAX_ROWS).map((row) => ({ id: row.customer.id, name: fullName(row.customer), detail: `${row.service.name} · ${t("assistant.lookup.lastSeen", { ago: agoText(row.lastVisit, clock.today) })}` })),
  };
  return { text: title, card, followUps: [t("assistant.lookup.dueBackOpen")], context: { customerIds: rows.map((row) => row.customer.id) }, topic: title };
}

function journal(input: LookupInput, text: string): Lookup {
  const { customer, several, denied } = namedCustomer(input, text);
  if (denied) return notServed();
  if (several) return whichCustomer(text, several);
  if (!customer) return message(t("assistant.lookup.journalWho"), { href: "/studio/customers", label: t("nav.customers") });
  const answer = t("assistant.lookup.journal", { name: fullName(customer) });
  return { text: answer, card: { kind: "message", text: answer, link: { href: customerHref(customer.id), label: t("assistant.lookup.openCustomer", { name: customer.firstName }) } }, context: { customerIds: [customer.id] } };
}

/** Words that ask for whoever is next, not a named person: "tell the next customer", "text my next client". */
const NEXT_RECIPIENT = /\b(?:the |my |our )?next (?:customer|client|one|booking|appointment|person)\b/;
/** Who the words address: "text Ida that…", "tell Ida Ek I'm…", "let Ida know…". Undefined when no one is addressed. */
function addressed(text: string): string | undefined {
  return text.match(/\b(?:text|sms|tell|message|email|let)\s+(.+?)(?:\s+(?:know|that|i'm|i am|we're|we are|i'll|we'll|about|i|we)\b|[,.!?]|$)/)?.[1]?.trim();
}

/**
 * "Text Ida that I'm running 15 minutes late": one simulated text to approve, about her booking today.
 * Only an explicit "next customer" falls back on whoever is next; a name that matches nobody gets a question, never a guess.
 */
function runningLate(input: LookupInput, text: string): Lookup | null {
  if (!input.owner) return null;
  const { state, clock } = input;
  const minutes = Number(text.match(/\b(\d{1,3})\s*(?:min|minutes?)\b/)?.[1] ?? 10);
  const named = namedCustomer({ ...input, context: { customerIds: [] } }, text);
  if (named.several) return whichCustomer(text, named.several);
  const upcoming = state.bookings.filter((b) => b.status === "booked" && b.date === clock.today && b.start + b.duration > clock.minutes).sort((a, b) => a.start - b.start);
  const today = { href: "/studio", label: t("nav.today") };
  const toNext = !named.customer && NEXT_RECIPIENT.test(text);
  if (!named.customer && !toNext) {
    const said = addressed(text)?.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
    return message(said && !/^(?:them|him|her|the customer|the client)$/i.test(said) ? t("assistant.lookup.lateUnknown", { name: said }) : t("assistant.lookup.lateWhich"), today);
  }
  const booking = named.customer ? upcoming.find((b) => b.customerId === named.customer!.id) : upcoming[0];
  const customer = named.customer ?? (booking ? findCustomer(state, booking.customerId) : undefined);
  if (!customer || !booking) return message(t(named.customer ? "assistant.lookup.lateNoBooking" : "assistant.lookup.lateWho", { name: named.customer ? fullName(named.customer) : "" }), today);
  const body = t("assistant.late.sms", { name: customer.firstName, salon: state.salon.name, minutes, time: formatTime(booking.start + minutes) });
  const card: Proposal = {
    kind: "change",
    title: t("assistant.late.title", { name: fullName(customer) }),
    subtitle: t("assistant.offer.subtitle"),
    rows: [
      { label: t("assistant.row.to"), after: `${fullName(customer)} · ${formatTime(booking.start)}` },
      { label: t("assistant.row.message"), after: body },
    ],
    action: { type: "customers/message", texts: [{ customerId: customer.id, title: t("assistant.late.logTitle", { name: customer.firstName }), body }], at: { date: clock.today, time: clock.minutes } },
    toast: t("assistant.late.sent", { name: customer.firstName }),
  };
  return { text: t("assistant.reply.change"), card, context: { customerIds: [customer.id], date: clock.today }, topic: card.title };
}

/** Things the owner asks for that the rules cannot do exactly: say so and point to where it is done. */
function notHere(text: string): Lookup | null {
  if (/\bno[- ]?show\b|\bdid ?n[o']t (?:show|turn) up\b/.test(text)) return message(t("assistant.cannot.noShow"), { href: "/studio", label: t("nav.today") });
  if (/\b(?:block|hold)\b.*\b\d{1,2}(?::\d{2})?\b|\bblock\b.*\b(?:lunch|break|hour)\b/.test(text)) return message(t("assistant.cannot.block"), { href: "/studio/calendar", label: t("nav.calendar") });
  if (/\b(?:waiting list|waitlist)\b/.test(text) && /\b(?:put|add|join)\b/.test(text)) return message(t("assistant.cannot.waitlist"), { href: "/studio/calendar", label: t("nav.calendar") });
  if (/\bclos(?:e|ing)\b/.test(text) && (/\bearly\b/.test(text) || /\b(?:at|from|after)\s+\d{1,2}\b/.test(text))) return { ...message(t("assistant.cannot.closeEarly"), { href: "/studio/more/staff", label: t("nav.staff") }), followUps: [t("assistant.cannot.closeEarlyInstead")] };
  return null;
}

/** The answer to a read question, or null when the words are not one: the command rules take over. */
export function lookup(input: LookupInput, understood: string): Lookup | null {
  const text = understood.toLowerCase().replace(/’/g, "'").trim();
  const cannot = notHere(text);
  if (cannot) return cannot;
  // Each answer is gated by the page it stands for, the same rule the studio's navigation uses.
  const may = (href: string) => canOpen(role(input), href);
  if (/\bgift ?cards?\b/.test(text) && /\b(left|balance|worth|remaining|how much)\b/.test(text)) return may("/studio/more/giftcards") ? giftCard(input, text) : ownerOnly();
  if (/\b(?:running|be|i'm|i am)\b.*\blate\b|\bdelayed\b/.test(text) && /\b(text|sms|tell|message|let)\b/.test(text)) return runningLate(input, text);
  if (/\bwho(?:'s| is| comes)? (?:up )?next\b|\bnext (?:client|customer|booking|appointment|visit)\b(?!.*\b(?:for|with)\b)/.test(text) && !/\bwhen\b/.test(text) && !/\b(book|move|cancel)\b/.test(text)) return nextClient(input);
  if (/\bwhen (?:is|does|are)\b.*\b(?:next|coming|booked|back|appointment|booking|visit)\b|\b(?:next|upcoming) (?:appointment|booking|visit)\b/.test(text) && !/\b(book|move|cancel|reschedule)\b(?! ?ed)/.test(text.replace(/\bbooked\b/g, ""))) {
    const answer = nextAppointment(input, text);
    if (answer) return answer;
  }
  if (/\blast (?:time|visit|appointment|here|in)\b|\bwhen was\b/.test(text) && /\b(what|when|which)\b/.test(text) && !/\bsame\b/.test(text)) {
    const answer = lastVisit(input, text);
    if (answer) return answer;
  }
  if (/\b(?:any|is there|have we got|do (?:we|i) have) (?:a )?(?:room|space|free|time|times|slot|slots|availability|gap|opening)\b|\bcan (?:i|we) (?:fit|squeeze)\b|\bfree (?:time|times|slot|slots)\b|\bavailab(?:le|ility)\b|\bwhen can\b.*\b(?:come|fit)\b/.test(text) && !/\b(left|in stock)\b/.test(text)) return availability(input, text, understood);
  if (/\b(?:what does|what do|how much (?:is|does|for)|what(?:'s| is) the price|price (?:of|for)|how long (?:is|does|do)|cost of)\b/.test(text) && !/\b(left|remaining|in stock|set|change|update|raise|lower|earn|earned|make|made)\b/.test(text) && !/\d\s*(?:sek|kr|%)/.test(text)) {
    const answer = servicePrice(input, text);
    if (answer) return may("/studio/more/services") ? answer : ownerOnly();
  }
  if (/\binbox\b|\b(?:anything|what(?:'s| is)|who(?:'s| is)) (?:waiting|unanswered)\b|\bwaiting for (?:a |an )?(?:reply|answer)\b/.test(text)) return may("/studio/inbox") ? inbox(input) : ownerOnly();
  if (/\bdue (?:back|for)\b|\boverdue\b|\bshould (?:be|come) back\b/.test(text)) return may("/studio/customers/due-back") ? dueBack(input, text) : ownerOnly();
  if (/\bjournal\b/.test(text)) return journal(input, text);
  return null;
}
