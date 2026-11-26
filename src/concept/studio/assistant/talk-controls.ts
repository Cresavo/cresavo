import type { ConversationEnd, ConversationPhase } from "./conversation";

/** The spoken-conversation controls the assistant panel can render. */
export interface TalkControls {
  enabled: boolean;
  phase: ConversationPhase;
  muted: boolean;
  ended?: ConversationEnd;
  active: boolean;
  interim: string;
  listening: boolean;
  press(): void;
  start(): void;
  stop(): void;
  interrupt(): void;
  setMuted(muted: boolean): void;
  close(): void;
}

const noop = () => {};

/** When the Labs switch is off, or the conversation chunk has not loaded yet. */
export const INACTIVE_TALK: TalkControls = {
  enabled: false,
  phase: "off",
  muted: false,
  ended: undefined,
  active: false,
  interim: "",
  listening: false,
  press: noop,
  start: noop,
  stop: noop,
  interrupt: noop,
  setMuted: noop,
  close: noop,
};

/** True while the Labs switch is on but the conversation chunk has not yet enabled talking. */
export function holdListenRequest(labOn: boolean, talkEnabled: boolean): boolean {
  return labOn && !talkEnabled;
}
