import type { DemoAction } from "../actions";
import { buildIntentContext } from "../command/intent-context";
import { lapsedCustomers, proposalFor, type Proposal } from "../command/proposal";
import { addDays } from "../data/dates";
import type { DemoState, StaffId } from "../data/types";
import type { Clock } from "../finance/types";
import { t, tc } from "../i18n";
import { formatDayLong, formatMoney } from "../i18n/format";
import { interpretCommand, type IntentParams } from "../intent";
import { canCommand, type Role } from "../ops/access";
import { fullName } from "../selectors";
import { listBookings } from "../tools/read";
import { closingBrief, morningBrief, weeklyBrief, type Brief } from "./briefs";
import { memoryFor, memoryRejection, memorySubject, noticedFact, rememberRequest, safeMemory, searchMemory } from "./memory";
import { offerProposal } from "./outreach";
import { suggestedRoutines } from "./routines";
import { meansThoseCustomers, nextContext, resolveReferences, type Message, type Reply, type ReplyCard, type ThreadContext } from "./thread";

// The rule-based conversation: one reply per message, grounded in the demo
// data through the same proposals and read tools the command box and MCP
// use. It works without any AI key. With a key, `assistant-reply` may only
// rephrase the reply text; the cards and proposals always come from here.

export interface EngineInput {
  state: DemoState;
  text: string;
  context: ThreadContext;
  clock: Clock;
  role: Role;
  /** The staff member the staff view stands for. */
  viewer?: StaffId;
  /** Commands to offer when the message is not understood. */
  examples: string[];
}

export interface EngineResult {
  reply: Reply;
  context: ThreadContext;
  /** The message with "her", "that day" and the like filled in. */
  understood: string;
  /** Changes the owner asked for directly ("remember…", "forget…"); applied at once, with Undo. */
  effects: DemoAction[];
}

const rules = (text: string, extra: Partial<Reply> = {}): Reply => ({ source: "rules", text, ...extra });

function result(input: EngineInput, understood: string, reply: Reply, context = input.context, effects: DemoAction[] = []): EngineResult {
  return { reply, context, understood, effects };
}

function rememberReply(input: EngineInput, understood: string, note: string): EngineResult {
  const { state, clock } = input;
  const rejection = memoryRejection(note, state);
  if (rejection) return result(input, understood, rules(t(`assistant.memory.rejected.${rejection}`)));
  const subject = memorySubject(state, note);
  if (subject.customers.length > 1) {
    const firstName = subject.customers[0].firstName;
    const choices = subject.customers.slice(0, 4).map((customer) => ({
      label: fullName(customer),
      text: `Remember ${note.replace(new RegExp(`\\b${firstName}\\b`, "i"), fullName(customer))}`,
    }));
    const card: ReplyCard = { kind: "choose", title: t("assistant.memory.which", { name: firstName }), choices };
    return result(input, understood, rules(card.title, { card }));
  }
  const customer = subject.customers[0];
  const item = memoryFor(state, note, customer, clock.today, "owner");
  const context = customer ? { ...input.context, customerIds: [customer.id] } : input.context;
  return result(
    input,
    understood,
    rules(t("assistant.memory.saved"), { card: { kind: "memory-saved", item } }),
    context,
    [{ type: "memory/add", item }],
  );
}

function forgetReply(input: EngineInput, understood: string, what: string): EngineResult {
  const matches = searchMemory(input.state.memory, what.replace(/^that\s+/i, ""));
  if (!matches.length) return result(input, understood, rules(t("assistant.memory.notFound")));
  if (matches.length > 1) return result(input, understood, rules(t("assistant.memory.several"), { card: { kind: "memory-list", items: matches, query: what } }));
  return result(input, understood, rules(t("assistant.memory.forgotten", { text: matches[0].text })), input.context, [{ type: "memory/forget", id: matches[0].id }]);
}

function briefReply(input: EngineInput, understood: string, brief: Brief): EngineResult {
  const text = brief.items.length ? brief.title : t("assistant.brief.quiet");
  return result(input, understood, rules(text, { card: { kind: "brief", brief }, topic: brief.title }));
}

function routinesReply(input: EngineInput, understood: string): EngineResult {
  const [suggestion] = suggestedRoutines(input.state, input.clock);
  if (suggestion) return result(input, understood, rules(t("assistant.routine.suggest"), { card: { kind: "routine-offer", suggestion }, topic: suggestion.routine.name }));
  const on = input.state.routines.filter((r) => r.enabled).map((r) => r.name);
  return result(input, understood, rules(on.length ? t("assistant.routine.running", { names: on.join(", ") }) : t("assistant.routine.none"), {
    card: { kind: "message", text: t("assistant.routine.manage"), link: { href: "/studio/more/routines", label: t("nav.routines") } },
  }));
}

/** "Send an offer to the customers who haven't been here since summer", or "…to them" after a list. */
function offerReply(input: EngineInput, understood: string): EngineResult {
  const { state, clock, context } = input;
  const intent = interpretCommand(understood, buildIntentContext(state, clock.today, clock.minutes));
  const customerIds =
    intent.action === "inactive-customers" && intent.params.since
      ? lapsedCustomers(state, intent.params.since, clock.today).map((row) => row.customer.id)
      : meansThoseCustomers(understood) ? context.customerIds : [];
  if (!customerIds.length) {
    return result(input, understood, rules(t("assistant.offer.who"), { followUps: [t("assistant.example.inactive")] }));
  }
  const card = offerProposal(state, customerIds, clock);
  return result(input, understood, rules(t("assistant.reply.change"), { card, topic: tc("assistant.topic.offer", customerIds.length) }), { ...context, customerIds });
}

/** A booking as the `list_bookings` tool returns it. */
interface ToolBooking {
  id: string;
  start: string;
  status: string;
  customer: { id: string; name: string };
  service: { name: string };
  staff: { name: string };
}

/** "Who is coming today?" through the shared `list_bookings` read tool. Staff only see their own bookings. */
function bookingsReply(input: EngineInput, understood: string): EngineResult {
  const { state, clock } = input;
  const date = /\btomorrow\b/i.test(understood) ? addDays(clock.today, 1) : clock.today;
  const data = listBookings.run({ state, clock }, { from: date, staffId: input.role === "staff" ? input.viewer : undefined }) as { bookings: ToolBooking[] };
  const booked = data.bookings.filter((b) => b.status === "booked" || b.status === "completed");
  const title = tc("assistant.bookings.title", booked.length, { day: formatDayLong(date) });
  const card: ReplyCard = { kind: "bookings", title, items: booked.map((b) => ({ id: b.id, time: b.start, name: b.customer.name, detail: `${b.service.name} · ${b.staff.name}` })) };
  return result(input, understood, rules(title, { card, topic: title }), { ...input.context, date, customerIds: booked.map((b) => b.customer.id) });
}

/** The reply text for a proposal or answer from the command box. */
function describe(card: Proposal): { text: string; topic?: string; followUps?: string[] } {
  switch (card.kind) {
    case "change":
      return { text: t("assistant.reply.change"), topic: card.title };
    case "choose":
      return { text: card.title };
    case "message":
      return { text: card.text };
    case "insight":
      return { text: `${card.title}: ${card.value}. ${card.note}`, topic: card.title };
    case "revenue":
      return { text: `${card.title}: ${formatMoney(card.total)} · ${card.range}`, topic: `${card.title} ${card.range}` };
    case "customers":
      return { text: `${card.title}: ${tc("command.customers.count", card.total)}`, topic: card.title, followUps: card.total ? [t("assistant.example.offerThem")] : undefined };
    case "stock":
      return { text: card.title, topic: card.title };
  }
}

/** The ids of everyone in a customer answer, not just the ones listed on the card. */
function listedCustomers(state: DemoState, params: IntentParams, card: Proposal, today: string): string[] | undefined {
  return card.kind === "customers" && params.since ? lapsedCustomers(state, params.since, today).map((row) => row.customer.id) : undefined;
}

function commandReply(input: EngineInput, understood: string): EngineResult {
  const { state, clock, role } = input;
  const intent = interpretCommand(understood, buildIntentContext(state, clock.today, clock.minutes));
  const card = proposalFor(state, intent, understood, clock, input.examples, role);
  const notUnderstood = intent.action === "question" && card.kind === "choose" && card.choices.every((choice) => input.examples.includes(choice.label));
  if (notUnderstood) return result(input, understood, rules(t("assistant.fallback"), { followUps: input.examples }));
  const { text, topic, followUps } = describe(card);
  const context = nextContext(input.context, state, intent.params, card, listedCustomers(state, intent.params, card, clock.today));
  return result(input, understood, rules(text, { card, topic, followUps }), context);
}

const ownerOnly = (input: EngineInput, understood: string) => result(input, understood, rules(t("command.ownerOnly")));

/** One reply to one message. Pure: the caller applies `effects` and stores the context. */
export function respond(input: EngineInput): EngineResult {
  const text = input.text.trim();
  const understood = resolveReferences(text, input.context, input.state);
  const owner = input.role === "owner";
  if (!text) return result(input, understood, rules(t("assistant.fallback"), { followUps: input.examples }));

  const note = rememberRequest(understood);
  if (note) return owner ? rememberReply(input, understood, note) : ownerOnly(input, understood);
  const forget = understood.match(/^(?:please\s+)?forget\s+(?:about\s+)?(.+?)[.!]*$/i);
  if (forget) return owner ? forgetReply(input, understood, forget[1]) : ownerOnly(input, understood);
  const recall = understood.match(/^what do you (?:remember|know)(?:\s+about\s+(.+?))?\??$/i);
  if (recall) {
    if (!owner) return ownerOnly(input, understood);
    const items = searchMemory(input.state.memory, recall[1] ?? "");
    return result(input, understood, rules(items.length ? tc("assistant.memory.count", items.length) : t("assistant.memory.empty"), { card: { kind: "memory-list", items, query: recall[1] ?? "" } }));
  }

  const lower = understood.toLowerCase();
  if (/\b(brief|weekly review|how (was|is) (the|this) week|how did (today|the day) go|closing summary)\b/.test(lower)) {
    if (!owner) return ownerOnly(input, understood);
    const brief = /\bweek/.test(lower) ? weeklyBrief(input.state, input.clock) : /\b(today|day) go|closing/.test(lower) ? closingBrief(input.state, input.clock) : morningBrief(input.state, input.clock);
    return briefReply(input, understood, brief);
  }
  if (/\broutines?\b/.test(lower)) return owner ? routinesReply(input, understood) : ownerOnly(input, understood);
  if (/\b(send|text|sms|message|email)\b.*\b(offer|greeting|discount|deal)\b/.test(lower)) return owner ? offerReply(input, understood) : ownerOnly(input, understood);
  if (/\bwho(?:'s| is)? (?:coming|in|booked)\b|\bwhat(?:'s| is) on\b/.test(lower)) return bookingsReply(input, understood);

  const fact = noticedFact(understood);
  if (fact && owner && !memoryRejection(fact, input.state)) {
    const subject = memorySubject(input.state, fact);
    const item = memoryFor(input.state, fact, subject.customers.length === 1 ? subject.customers[0] : undefined, input.clock.today, "assistant");
    return result(input, understood, rules(t("assistant.memory.offer"), { card: { kind: "memory-offer", item } }));
  }
  if (!canCommand(input.role, "revenue") && /\b(earn|earned|revenue|income|profit|compare)\b/.test(lower)) return ownerOnly(input, understood);
  return commandReply(input, understood);
}

const MAX_TURNS = 8;
const MAX_MEMORY = 20;

/** Facts for the model, from the card: numbers and labels, never customer names or contact details. */
function cardFacts(card: ReplyCard | undefined): string[] {
  if (!card) return [];
  switch (card.kind) {
    case "insight":
      return [card.title, card.value, card.note, ...card.chart.data.map((d) => `${d.label}: ${d.value}`)];
    case "revenue":
      return [`${card.title} ${card.range}: ${formatMoney(card.total)}`, tc("command.revenue.visits", card.visits)];
    case "customers":
      return [card.title, tc("command.customers.count", card.total)];
    case "change":
      return [card.title, ...card.rows.map((row) => `${row.label}: ${row.before ? `${row.before} → ` : ""}${row.after}`)];
    case "brief":
      return card.brief.items.map((item) => item.text);
    default:
      return [];
  }
}

/** Input for the `assistant-reply` task: the rule reply as a draft plus the filtered memory. Nothing the memory filter rejects is sent. */
export function replyRequest(state: DemoState, messages: Message[], understood: string, reply: Reply) {
  return {
    message: understood.slice(0, 500),
    draft: reply.text.slice(0, 1200),
    facts: cardFacts(reply.card).map((fact) => fact.slice(0, 300)).slice(0, 12),
    thread: messages
      .filter((m) => !["contact", "health", "journal"].includes(memoryRejection(m.text, state) ?? ""))
      .slice(-MAX_TURNS)
      .map((m) => ({ from: m.from, text: m.text.slice(0, 500) })),
    memory: safeMemory(state.memory, state).filter((item) => item.kind !== "thread").slice(0, MAX_MEMORY).map((item) => item.text),
  };
}
