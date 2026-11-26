import type { Locale } from "@/lib/locale";
import { receptionistInstructions, type InstructionInput } from "./instructions";
import { receptionistToolSchemas } from "./tools";

// The Realtime session of a call: model, voice, the rules and the tools. Built
// on the server only, so a browser never chooses the model or the tools it is
// billed for.

export const DEFAULT_REALTIME_MODEL = "gpt-realtime-mini";
const MODEL_NAME = /^gpt-[a-z0-9.-]{3,60}$/;

/** PHONE_RECEPTIONIST_MODEL replaces the mini model when it names a Realtime model. */
export function realtimeModel(env: Record<string, string | undefined>): string {
  const chosen = env.PHONE_RECEPTIONIST_MODEL?.trim();
  return chosen && MODEL_NAME.test(chosen) ? chosen : DEFAULT_REALTIME_MODEL;
}

/** Audio formats a transport can carry: the browser sends 24 kHz PCM, a phone line usually G.711. */
export type AudioFormat = { type: "audio/pcm"; rate: 24000 } | { type: "audio/pcmu" } | { type: "audio/pcma" };

export interface RealtimeSessionInput extends InstructionInput {
  model: string;
  /** Left out for WebRTC, where the browser negotiates the audio itself. */
  audioFormat?: AudioFormat;
}

// Writes the caller's words for the call log. This model has an announced shutdown (2027-02-26); `gpt-transcribe` replaces it.
const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const TRANSCRIPTION_LANGUAGE: Record<Locale, string> = { sv: "sv", en: "en" };

export function realtimeSession(input: RealtimeSessionInput) {
  const format = input.audioFormat ? { format: input.audioFormat } : {};
  return {
    type: "realtime" as const,
    model: input.model,
    instructions: receptionistInstructions(input),
    output_modalities: ["audio"],
    max_output_tokens: 1024,
    tool_choice: "auto",
    tools: receptionistToolSchemas(),
    audio: {
      input: {
        ...format,
        noise_reduction: { type: "near_field" },
        transcription: { model: TRANSCRIPTION_MODEL, language: TRANSCRIPTION_LANGUAGE[input.language] },
        turn_detection: { type: "semantic_vad", eagerness: "auto", create_response: true, interrupt_response: true },
      },
      output: { ...format, voice: "marin" },
    },
  };
}
