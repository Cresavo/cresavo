import { isDateKey } from "../data/dates";
import type { DemoState } from "../data/types";
import {
  DEFAULT_RECEPTIONIST,
  MAX_CALLS,
  MAX_GREETING,
  MAX_LINE_LENGTH,
  MAX_TRANSCRIPT_LINES,
  type CallRecord,
  type ReceptionistSettings,
  type TranscriptLine,
} from "./types";

// Store actions for the phone receptionist's settings and call log. Bookings a
// call makes go through the ordinary booking actions, never through these.

export type ReceptionistAction =
  | { type: "receptionist/settings"; settings: Partial<ReceptionistSettings> }
  /** Saves a finished call, or replaces the record with the same id. */
  | { type: "receptionist/call"; call: CallRecord };

const ANSWER_WHEN = new Set<ReceptionistSettings["answerWhen"]>(["always", "open", "closed"]);
const OUTCOMES = new Set<CallRecord["outcome"]>(["booked", "moved", "cancelled", "handover", "none"]);
const ENDS = new Set<CallRecord["endedBy"]>(["caller", "receptionist", "time-limit", "cost-limit", "error"]);
const CHANNELS = new Set<CallRecord["channel"]>(["browser-test", "phone"]);

export function receptionistSettings(state: Pick<DemoState, "receptionist">): ReceptionistSettings {
  return state.receptionist ?? DEFAULT_RECEPTIONIST;
}

/** Control characters out, runs of whitespace to one space: text that is later read to a model or shown in a list. */
export function plainText(text: string, max: number): string {
  return text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanLine(line: TranscriptLine): TranscriptLine | null {
  if (!line || (line.who !== "caller" && line.who !== "receptionist") || typeof line.text !== "string") return null;
  const text = plainText(line.text, MAX_LINE_LENGTH);
  if (!text) return null;
  return { who: line.who, text, at: Number.isFinite(line.at) ? Math.max(0, Math.round(line.at)) : 0 };
}

function cleanCall(state: DemoState, call: CallRecord): CallRecord | null {
  if (!call || typeof call.id !== "string" || !/^[A-Za-z0-9-]{4,64}$/.test(call.id)) return null;
  if (!isDateKey(call.date) || !CHANNELS.has(call.channel) || !OUTCOMES.has(call.outcome) || !ENDS.has(call.endedBy)) return null;
  if (!Number.isInteger(call.time) || call.time < 0 || call.time >= 24 * 60) return null;
  if (!Number.isFinite(call.durationSec) || call.durationSec < 0 || !Array.isArray(call.transcript)) return null;
  // A call may only point at records of this salon.
  const bookingId = state.bookings.some((b) => b.id === call.bookingId) ? call.bookingId : undefined;
  const customerId = state.customers.some((c) => c.id === call.customerId) ? call.customerId : undefined;
  const cost = typeof call.costUsd === "number" && Number.isFinite(call.costUsd) && call.costUsd >= 0 ? Math.round(call.costUsd * 10_000) / 10_000 : null;
  return {
    id: call.id,
    channel: call.channel,
    date: call.date,
    time: call.time,
    durationSec: Math.round(call.durationSec),
    outcome: call.outcome,
    endedBy: call.endedBy,
    ...(bookingId ? { bookingId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(call.handoverReason ? { handoverReason: plainText(String(call.handoverReason), MAX_LINE_LENGTH) } : {}),
    costUsd: cost,
    transcript: call.transcript.slice(0, MAX_TRANSCRIPT_LINES).flatMap((line) => cleanLine(line) ?? []),
  };
}

export function applyReceptionist(state: DemoState, action: ReceptionistAction): DemoState {
  switch (action.type) {
    case "receptionist/settings": {
      const current = receptionistSettings(state);
      const next: ReceptionistSettings = {
        enabled: typeof action.settings.enabled === "boolean" ? action.settings.enabled : current.enabled,
        greeting: typeof action.settings.greeting === "string" ? plainText(action.settings.greeting, MAX_GREETING) : current.greeting,
        answerWhen: action.settings.answerWhen ?? current.answerWhen,
      };
      if (!ANSWER_WHEN.has(next.answerWhen)) return state;
      if (next.enabled === current.enabled && next.greeting === current.greeting && next.answerWhen === current.answerWhen) return state;
      return { ...state, receptionist: next };
    }
    case "receptionist/call": {
      const call = cleanCall(state, action.call);
      if (!call) return state;
      const others = (state.receptionistCalls ?? []).filter((saved) => saved.id !== call.id);
      return { ...state, receptionistCalls: [call, ...others].slice(0, MAX_CALLS) };
    }
  }
}
