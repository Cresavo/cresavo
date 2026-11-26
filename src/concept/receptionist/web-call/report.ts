import { estimateResponseCost, type Rates, type RealtimeUsage } from "../limits";

// What the server's own connection saw of a call, for one log line when it
// ends: how long it ran, what it cost, and the shape of each turn (who spoke,
// for how long, how many words, whether the caller's words could be written
// down, whether Maja was cut off). Enough to see a turn she answered without
// hearing it. No words of either side are kept: callers say names, numbers
// and health details, and none of that belongs in a log.

const MAX_TURNS = 40;

export interface CallTurn {
  /** Seconds into the call. */
  at: number;
  who: "caller" | "maja";
  /** How many words were written down (caller) or spoken (Maja). */
  words: number;
  /** Caller turns: how long the speech lasted, and whether the transcription failed or came back blank. */
  speechMs?: number;
  heard?: "ok" | "blank" | "failed" | "pending";
  /** Maja turns: how the answer ended, and whether it answered a caller turn that was not heard. */
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
  response?: { status?: string; usage?: RealtimeUsage; output?: { type?: string; content?: { transcript?: unknown }[] }[] };
};

const n = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);
const wordCount = (text: unknown) => (typeof text === "string" ? text.split(/\s+/).filter(Boolean).length : 0);

export function callRecorder(rates: Rates, now: () => number = Date.now) {
  const started = now();
  const at = () => Math.round((now() - started) / 100) / 10;
  const report: CallReport = {
    seconds: 0, costUsd: 0, responses: 0, interrupted: 0, callerTurns: 0, unheardTurns: 0, answeredUnheard: 0,
    tokens: { textIn: 0, cachedIn: 0, audioIn: 0, textOut: 0, audioOut: 0 }, turns: [],
  };
  const byItem = new Map<string, CallTurn>();
  const speechStart = new Map<string, number>();
  /** Maja's answers to each caller turn, so a transcription that arrives after the answer still counts. */
  const answers = new Map<CallTurn, CallTurn[]>();
  let lastCaller: CallTurn | undefined;
  const push = (turn: CallTurn) => {
    if (report.turns.length < MAX_TURNS) report.turns.push(turn);
    return turn;
  };
  const markUnheard = (caller: CallTurn) => {
    const replies = answers.get(caller) ?? [];
    if (replies.length && !replies.some((reply) => reply.unheard)) report.answeredUnheard += 1;
    for (const reply of replies) reply.unheard = true;
  };
  return {
    observe(event: Event) {
      switch (event.type) {
        case "input_audio_buffer.speech_started": {
          // The start of the speech comes with this event; the end comes with speech_stopped.
          if (event.item_id) speechStart.set(event.item_id, n(event.audio_start_ms));
          break;
        }
        case "input_audio_buffer.speech_stopped": {
          report.callerTurns += 1;
          const begun = event.item_id ? speechStart.get(event.item_id) : undefined;
          const speechMs = begun === undefined ? 0 : Math.max(0, n(event.audio_end_ms) - begun);
          const turn = push({ at: at(), who: "caller", words: 0, speechMs: speechMs || undefined, heard: "pending" });
          if (event.item_id) byItem.set(event.item_id, turn);
          lastCaller = turn;
          break;
        }
        case "conversation.item.input_audio_transcription.completed":
        case "conversation.item.input_audio_transcription.failed": {
          const turn = (event.item_id && byItem.get(event.item_id)) || push({ at: at(), who: "caller", words: 0 });
          turn.words = event.type.endsWith("failed") ? 0 : wordCount(event.transcript);
          turn.heard = event.type.endsWith("failed") ? "failed" : turn.words ? "ok" : "blank";
          if (turn.heard !== "ok") {
            report.unheardTurns += 1;
            markUnheard(turn);
          }
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
          const reply = push({ at: at(), who: "maja", words: wordCount(said), status: response.status });
          if (lastCaller) {
            answers.set(lastCaller, [...(answers.get(lastCaller) ?? []), reply]);
            // An answer to a caller turn that could not be written down: she may have guessed.
            if (lastCaller.heard === "blank" || lastCaller.heard === "failed") markUnheard(lastCaller);
          }
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
