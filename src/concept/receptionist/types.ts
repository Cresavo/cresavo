import type { DateKey } from "../data/types";

// The phone receptionist ("Maja"): what a salon keeps about it. The settings
// and the call log are part of the salon's state behind `StudioStore`, so they
// follow the salon and never mix between salons.

/** The receptionist's name, the same in every language. */
export const RECEPTIONIST_NAME = "Maja";

/** When the receptionist answers: always, only while the salon is open, or only while it is closed. */
export type AnswerWhen = "always" | "open" | "closed";

export interface ReceptionistSettings {
  enabled: boolean;
  /** Said first in every call. Empty means the standard greeting in the salon's language. */
  greeting: string;
  answerWhen: AnswerWhen;
}

export const DEFAULT_RECEPTIONIST: ReceptionistSettings = { enabled: false, greeting: "", answerWhen: "always" };

export const MAX_GREETING = 240;

export interface TranscriptLine {
  who: "caller" | "receptionist";
  text: string;
  /** Seconds into the call. */
  at: number;
}

/** What a call led to. */
export type CallOutcome = "booked" | "moved" | "cancelled" | "handover" | "none";

/** Why a call ended. */
export type CallEnd = "caller" | "receptionist" | "time-limit" | "cost-limit" | "error";

/** How the caller reached the receptionist. */
export type CallChannel = "browser-test" | "phone";

export interface CallRecord {
  id: string;
  channel: CallChannel;
  date: DateKey;
  /** Minute of the salon's day the call started. */
  time: number;
  durationSec: number;
  outcome: CallOutcome;
  endedBy: CallEnd;
  /** The booking the call made, moved or cancelled. */
  bookingId?: string;
  customerId?: string;
  /** Why the receptionist handed over, in her own words. */
  handoverReason?: string;
  /** Estimated from the provider's token counts; null when none were reported. */
  costUsd: number | null;
  transcript: TranscriptLine[];
}

/** Newest calls kept per salon; older ones fall off so the salon document stays small. */
export const MAX_CALLS = 30;
export const MAX_TRANSCRIPT_LINES = 120;
export const MAX_LINE_LENGTH = 600;
