import type { Proposal } from "../command/proposal";
import type { DateKey, DemoState, StaffId } from "../data/types";
import type { IntentParams } from "../intent";
import { fullName } from "../selectors";
import type { Brief } from "./briefs";
import { memoryRejection, type MemoryItem, type NewMemory } from "./memory";
import type { RoutineSuggestion } from "./routines";

// A conversation with the assistant: what was said, the cards it answered
// with, and the context that lets a follow-up say "her", "them", "that day"
// or "the same as last time".

/** What the conversation is about right now. */
export interface ThreadContext {
  /** The customer(s) last talked about. Several after a list such as "not back since summer". */
  customerIds: string[];
  staffId?: StaffId;
  date?: DateKey;
  serviceId?: string;
}

/** A card in a reply: a proposal or answer from the command box, or one of the assistant's own. */
export type ReplyCard =
  | Proposal
  | { kind: "memory-saved"; item: NewMemory }
  | { kind: "memory-offer"; item: NewMemory }
  | { kind: "memory-list"; items: MemoryItem[]; query: string }
  | { kind: "brief"; brief: Brief }
  | { kind: "routine-offer"; suggestion: RoutineSuggestion }
  | { kind: "bookings"; title: string; items: { id: string; time: string; name: string; detail: string }[] };

export interface Reply {
  /** "rules" when no AI model was used; the panel labels it. */
  source: "rules" | "ai";
  text: string;
  card?: ReplyCard;
  /** Tappable next questions. */
  followUps?: string[];
  /** Short label of the subject, used when a past conversation is summarised. */
  topic?: string;
  /** What happened to a proposal or offer in this reply. "edited": the owner took the request back into the message box. */
  status?: "approved" | "declined" | "failed" | "undone" | "edited";
  /** The activity log entry of the change this reply made, so the panel can offer Undo. */
  undoId?: string;
  /** The owner's words this reply answers, for Edit. */
  request?: string;
  /** How the owner said it. Carried through approval so the activity log tells voice from typed commands. */
  input?: InputMode;
  /** An AI model's reading of the same words is on its way and may still replace this reply. */
  refining?: boolean;
}

export type InputMode = "typed" | "voice";

export interface Message {
  id: string;
  from: "owner" | "assistant";
  /** What the owner said, or the assistant's reply text. */
  text: string;
  /** The owner's words with references filled in, when that changed them. */
  understood?: string;
  reply?: Reply;
  /** Epoch milliseconds. */
  at: number;
}

const MAX_SUMMARY = 180;

export const emptyContext = (): ThreadContext => ({ customerIds: [] });

const one = (context: ThreadContext) => (context.customerIds.length === 1 ? context.customerIds[0] : undefined);

/** The customer's latest booking (done or coming), for "the same as last time". */
function lastBooking(state: DemoState, customerId: string) {
  return state.bookings
    .filter((b) => b.customerId === customerId && b.status !== "cancelled")
    .sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start)[0];
}

/**
 * Fills in what a follow-up leaves out, from the conversation so far:
 * "her"/"him" → the customer's full name, "that day" → the date,
 * "the same as last time" → that customer's last treatment and person.
 * "them" is left alone; the engine reads the customer list from the context.
 */
export function resolveReferences(text: string, context: ThreadContext, state: DemoState): string {
  const customerId = one(context);
  const customer = customerId ? state.customers.find((c) => c.id === customerId) : undefined;
  let resolved = text;
  if (customer) {
    const name = fullName(customer);
    resolved = resolved.replace(/\b(her|him)\b(?!self)/i, name).replace(/\b(she|he)\b(?=\s)/i, name);
    const last = lastBooking(state, customer.id);
    const service = last && state.services.find((s) => s.id === last.serviceId);
    const staff = last && state.staff.find((s) => s.id === last.staffId);
    if (service && staff) resolved = resolved.replace(/\b(?:the\s+)?same(?:\s+\w+)?\s+as\s+last\s+time\b/i, `${service.name} with ${staff.firstName}`);
  }
  if (context.date) resolved = resolved.replace(/\b(?:on\s+)?(?:that|the same)\s+day\b/i, `on ${context.date}`);
  return resolved;
}

/** "Them", "those customers", "these": a follow-up about the customers in the last list. */
export function meansThoseCustomers(text: string): boolean {
  return /\b(them|those|these|this list|that list)\b/i.test(text);
}

/** The context after a proposal or answer: who and what the conversation is about now. */
export function nextContext(previous: ThreadContext, state: DemoState, params: IntentParams, card?: ReplyCard, listed?: string[]): ThreadContext {
  const booking = params.bookingId ? state.bookings.find((b) => b.id === params.bookingId) : undefined;
  const customerId = params.customerId ?? booking?.customerId;
  const changeTarget = card?.kind === "change" && card.action.type === "booking/create" ? card.action : undefined;
  return {
    customerIds: listed ?? (customerId ? [customerId] : previous.customerIds),
    staffId: (params.staffId as StaffId | undefined) ?? changeTarget?.staffId ?? booking?.staffId ?? previous.staffId,
    date: params.date ?? changeTarget?.date ?? previous.date,
    serviceId: params.serviceId ?? booking?.serviceId ?? previous.serviceId,
  };
}

/** A short summary of a finished conversation for the memory, made from topics only, never from what was said. */
export function threadSummary(messages: Message[]): string | null {
  const topics = [...new Set(messages.flatMap((m) => (m.reply?.topic && !memoryRejection(m.reply.topic) ? [m.reply.topic] : [])))];
  let summary = "";
  for (const topic of topics) {
    const next = summary ? `${summary}; ${topic}` : topic;
    if (next.length > MAX_SUMMARY) break;
    summary = next;
  }
  return summary || null;
}
