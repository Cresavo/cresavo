import { estimateResponseCost, type Rates, type RealtimeUsage } from "../limits";

// What the server's own connection saw of a call, for one log line when it
// ends: how long it ran, what it cost, how each caller turn was heard, and
// what Maja said back. Enough to see a turn she answered without hearing it;
// no more of the caller than that. Digits and e-mail addresses are masked and
// every line is cut short, so phone numbers and addresses never reach a log.

const MAX_TURNS = 40;
const MAX_TEXT = 90;

/** Masks digits and e-mail addresses and cuts the line short. */
export function maskedLine(text: unknown): string {
  if (typeof text !== "string") return "";
  const clean = text.replace(/\s+/g, " ").trim().replace(/[^\s@]+@[^\s@]+/g, "<e-mail>").replace(/\d/g, "#");
  return clean.length > MAX_TEXT ? `${clean.slice(0, MAX_TEXT - 1)}…` : clean;
}

export interface CallTurn {
  /** Seconds into the call. */
  at: number;
  who: "caller" | "maja";
  /** Masked words. Empty when the caller made a sound that could not be written down. */
  text: string;
  /** Caller turns: how long the speech lasted, and whether the transcription failed or came back blank. */
  speechMs?: number;
  heard?: "ok" | "blank" | "failed" | "pending";
  /** Maja turns: whether she was cut off, and whether she answered a caller turn that was not heard. */
  status?: string;
  unheard?: boolean;
}

export interface CallReport {
  seconds: number;
  costUsd: number;
  responses: number;
  interrupted: number;
  callerTurns: number;
  unheardTurns: number;
  answeredUnheard: number;
  tokens: { textIn: number; cachedIn: number; audioIn: number; textOut: number; audioOut: number };
  turns: CallTurn[];
}

type Event = {
  type?: string; item_id?: string; transcript?: unknown; audio_start_ms?: number; audio_end_ms?: number;
  response?: { id?: string; status?: string; usage?: RealtimeUsage; output?: { type?: string; content?: { transcript?: unknown }[] }[] };
};

const n = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);

export function callRecorder(rates: Rates, now: () => number = Date.now) {
  const started = now();
  const at = () => Math.round((now() - started) / 100) / 10;
  const report: CallReport = {
    seconds: 0, costUsd: 0, responses: 0, interrupted: 0, callerTurns: 0, unheardTurns: 0, answeredUnheard: 0,
    tokens: { textIn: 0, cachedIn: 0, audioIn: 0, textOut: 0, audioOut: 0 }, turns: [],
  };
  const byItem = new Map<string, CallTurn>();
  let lastCaller: CallTurn | undefined;
  const push = (turn: CallTurn) => {
    if (report.turns.length < MAX_TURNS) report.turns.push(turn);
    return turn;
  };
  return {
    observe(event: Event) {
      switch (event.type) {
        case "input_audio_buffer.speech_stopped": {
          report.callerTurns += 1;
          const turn = push({ at: at(), who: "caller", text: "", speechMs: Math.max(0, n(event.audio_end_ms) - n(event.audio_start_ms)) || undefined, heard: "pending" });
          if (event.item_id) byItem.set(event.item_id, turn);
          lastCaller = turn;
          break;
        }
        case "conversation.item.input_audio_transcription.completed":
        case "conversation.item.input_audio_transcription.failed": {
          const turn = (event.item_id && byItem.get(event.item_id)) || push({ at: at(), who: "caller", text: "" });
          const text = event.type.endsWith("failed") ? "" : maskedLine(event.transcript);
          turn.text = text;
          turn.heard = event.type.endsWith("failed") ? "failed" : text ? "ok" : "blank";
          if (turn.heard !== "ok") report.unheardTurns += 1;
          break;
        }
        case "response.done": {
          const response = event.response ?? {};
          report.responses += 1;
          if (response.status === "cancelled") report.interrupted += 1;
          const usage = response.usage;
          const input = usage?.input_token_details ?? {};
          report.tokens.textIn += n(input.text_tokens);
          report.tokens.audioIn += n(input.audio_tokens);
          report.tokens.cachedIn += n(input.cached_tokens);
          report.tokens.textOut += n(usage?.output_token_details?.text_tokens);
          report.tokens.audioOut += n(usage?.output_token_details?.audio_tokens);
          report.costUsd += estimateResponseCost(usage, rates);
          const said = (response.output ?? []).flatMap((item) => (item.content ?? []).map((part) => part.transcript)).filter((part) => typeof part === "string").join(" ");
          const tools = (response.output ?? []).filter((item) => item.type === "function_call").length;
          if (!said && tools) break;
          // An answer right after a caller turn that could not be written down: she may have guessed.
          const unheard = lastCaller !== undefined && lastCaller.heard !== "ok" && lastCaller.heard !== "pending";
          if (unheard) report.answeredUnheard += 1;
          push({ at: at(), who: "maja", text: maskedLine(said), status: response.status, unheard: unheard || undefined });
          lastCaller = undefined;
          break;
        }
      }
    },
    finish(): CallReport {
      report.seconds = Math.round((now() - started) / 1000);
      report.costUsd = Math.round(report.costUsd * 10_000) / 10_000;
      return report;
    },
  };
}
