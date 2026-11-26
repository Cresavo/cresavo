import type { Clock } from "../finance/types";
import { plainText } from "./actions";
import type { ReceptionistHost } from "./host";
import { openingInstruction, type InstructionInput } from "./instructions";
import { estimateResponseCost, WRAP_UP_COST_SHARE, WRAP_UP_SECONDS, type CallLimits, type Rates, type RealtimeUsage } from "./limits";
import { newCallMemory, runReceptionistTool, type CallMemory, type HandoverText } from "./tools";
import { MAX_LINE_LENGTH, MAX_TRANSCRIPT_LINES, type CallChannel, type CallEnd, type CallRecord, type TranscriptLine } from "./types";

// One call, whatever carries the audio. A transport (the browser's WebRTC
// connection today, a phone bridge later) feeds it the Realtime API's server
// events and sends back the client events it returns. The session runs the
// tools, keeps the transcript, counts time and cost against the ceiling, and
// says when to hang up.

/** A Realtime server event, as far as the session reads it. */
export interface ServerEvent {
  type: string;
  transcript?: string;
  response?: {
    usage?: RealtimeUsage;
    output?: { type?: string; name?: string; call_id?: string; arguments?: string }[];
  };
}

/** A Realtime client event the transport sends on. */
export type ClientEvent = Record<string, unknown> & { type: string };

export interface CallOptions {
  id: string;
  channel: CallChannel;
  host: ReceptionistHost;
  salon: InstructionInput;
  limits: CallLimits;
  handover: HandoverText;
  /** The salon's day and minute when the call started. */
  startedAt: Clock;
  /** Epoch milliseconds. */
  now: () => number;
  /** What she is asked to say first; the standard greeting instruction when left out. */
  opening?: string;
  /** Prices for the cost estimate; the mini model's when left out. */
  rates?: Rates;
}

export interface Step {
  send: ClientEvent[];
  /** Set when the call is over: the transport closes the audio and saves `record()`. */
  hangUp?: CallEnd;
}

const WRAP_UP = "The call has to end now. In one sentence, say kindly that you have to round off, offer that the staff can call back if something is unfinished, and say goodbye. Then call end_call.";

const systemNote = (text: string): ClientEvent => ({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text }] } });

export class ReceptionistCall {
  private readonly memory: CallMemory;
  private readonly transcript: TranscriptLine[] = [];
  private readonly started: number;
  private cost = 0;
  private reported = false;
  private wrappingUp = false;
  private ended: CallEnd | undefined;
  private endedAt: number | undefined;

  constructor(private readonly options: CallOptions) {
    this.memory = newCallMemory(options.id);
    this.started = options.now();
  }

  /** What the transport sends when the audio is connected: the greeting. */
  open(): ClientEvent[] {
    return [{ type: "response.create", response: { instructions: this.options.opening ?? openingInstruction(this.options.salon) } }];
  }

  get seconds(): number {
    return Math.max(0, Math.round(((this.endedAt ?? this.options.now()) - this.started) / 1000));
  }

  get costUsd(): number | null {
    return this.reported ? this.cost : null;
  }

  get lines(): readonly TranscriptLine[] {
    return this.transcript;
  }

  get over(): boolean {
    return this.ended !== undefined;
  }

  private say(who: TranscriptLine["who"], text: string | undefined) {
    const clean = plainText(text ?? "", MAX_LINE_LENGTH);
    if (clean && this.transcript.length < MAX_TRANSCRIPT_LINES) this.transcript.push({ who, text: clean, at: this.seconds });
  }

  private finish(reason: CallEnd, send: ClientEvent[] = []): Step {
    this.end(reason);
    return { send, hangUp: this.ended };
  }

  /** Marks the call over, e.g. when the caller hangs up or the connection drops. The first reason stands. */
  end(reason: CallEnd) {
    if (this.ended) return;
    this.ended = reason;
    this.endedAt = this.options.now();
  }

  /** Call about once a second: asks the receptionist to round off near the ceiling and ends the call at it. */
  tick(): Step {
    if (this.ended) return { send: [] };
    const { maxSeconds, maxCostUsd } = this.options.limits;
    if (this.seconds >= maxSeconds) return this.finish("time-limit");
    if (this.cost >= maxCostUsd) return this.finish("cost-limit");
    if (!this.wrappingUp && (this.seconds >= maxSeconds - WRAP_UP_SECONDS || this.cost >= maxCostUsd * WRAP_UP_COST_SHARE)) {
      this.wrappingUp = true;
      return { send: [systemNote(WRAP_UP), { type: "response.create" }] };
    }
    return { send: [] };
  }

  /** One server event in, the client events to send out. */
  async handle(event: ServerEvent): Promise<Step> {
    if (this.ended) return { send: [] };
    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed":
        this.say("caller", event.transcript);
        return { send: [] };
      // The second name is the one the API used before general availability.
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
        this.say("receptionist", event.transcript);
        return { send: [] };
      case "response.done":
        return this.responseDone(event);
      default:
        return { send: [] };
    }
  }

  private async responseDone(event: ServerEvent): Promise<Step> {
    if (event.response?.usage) {
      this.reported = true;
      this.cost += estimateResponseCost(event.response.usage, this.options.rates);
    }
    const calls = (event.response?.output ?? []).filter((item) => item.type === "function_call" && item.call_id && item.name);
    const send: ClientEvent[] = [];
    for (const call of calls) {
      const output = await runReceptionistTool({ host: this.options.host, memory: this.memory, handover: this.options.handover }, call.name!, call.arguments ?? "{}");
      send.push({ type: "conversation.item.create", item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(output) } });
    }
    // She has said goodbye and asked to hang up: no further reply is requested.
    if (this.memory.ended) return this.finish("receptionist", send);
    if (this.cost >= this.options.limits.maxCostUsd) return this.finish("cost-limit", send);
    if (send.length > 0) send.push({ type: "response.create" });
    return { send };
  }

  /** The finished call as the salon keeps it. */
  record(): CallRecord {
    const { id, channel, startedAt } = this.options;
    return {
      id,
      channel,
      date: startedAt.today,
      time: startedAt.minutes,
      durationSec: this.seconds,
      outcome: this.memory.outcome,
      endedBy: this.ended ?? "caller",
      bookingId: this.memory.bookingId,
      customerId: this.memory.customerId,
      handoverReason: this.memory.handoverReason,
      costUsd: this.costUsd,
      transcript: [...this.transcript],
    };
  }
}
