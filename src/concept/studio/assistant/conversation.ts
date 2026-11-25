// A spoken conversation with the assistant, as a small state machine over the
// browser's speech features. Push to start, never a wake word: the owner
// presses the microphone, speaks, the reply appears on screen and (unless
// muted) is read aloud, then the assistant listens again. Silence, Stop,
// closing the panel or leaving the tab ends it. Spoken words only ever become
// a message: approving, declining or changing anything stays on the screen.
// Plain functions over injected ports, so the rules are testable without React.

/** How long the assistant waits for the owner to start speaking before the conversation ends. */
export const CONVERSATION_SILENCE_MS = 15_000;

export type ConversationPhase =
  /** No conversation. */
  | "off"
  | "listening"
  /** The words were sent; the reply is on its way. */
  | "thinking"
  | "speaking"
  /** It ended; the panel says why until the next one starts. */
  | "ended";

export type ConversationEnd = "stopped" | "silence" | "hidden" | "failed";

export interface ConversationState {
  phase: ConversationPhase;
  muted: boolean;
  ended?: ConversationEnd;
}

export interface ConversationPorts {
  listen(): void;
  stopListening(): void;
  /** Reads text aloud and calls `done` when it has been said. False where the browser cannot speak. */
  speak(text: string, done: () => void): boolean;
  stopSpeaking(): void;
  /** Sends what was heard as a spoken message. */
  send(text: string): void;
  setTimer(run: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  onChange(state: ConversationState): void;
}

export interface Conversation {
  state(): ConversationState;
  start(): void;
  /** Final words from the recogniser while it is listening. */
  heard(text: string): void;
  /** Unfinished words arrived: the quiet moment starts again. */
  hearing(): void;
  /** The recogniser stopped. Without words it listens again until the silence timeout. */
  listenEnded(end: { heard: boolean; error?: string }): void;
  /** The turn now in flight, so a late reply can be dropped if a newer one has started. */
  turn(): number;
  /** The reply to the last message is on screen; `spoken` is the safe text to read, or null for none. A late reply from an earlier turn is ignored. */
  replied(spoken: string | null, expectedTurn?: number): void;
  /** Stops reading aloud and listens again: the microphone pressed during a reply, or a card tapped. */
  interrupt(): void;
  setMuted(muted: boolean): void;
  stop(reason?: ConversationEnd): void;
  /** The panel closed: nothing left on screen to say why. */
  close(): void;
}

const BLOCKED = new Set(["not-allowed", "service-not-allowed", "language-not-supported", "audio-capture", "failed"]);

export function createConversation(ports: ConversationPorts): Conversation {
  let current: ConversationState = { phase: "off", muted: false };
  let timer: unknown = null;
  /** Each turn has a number, so a late reply or a spoken line that finishes after Stop changes nothing. */
  let turn = 0;

  const set = (patch: Partial<ConversationState>) => {
    current = { ...current, ...patch };
    ports.onChange(current);
  };
  const clearSilence = () => {
    if (timer !== null) ports.clearTimer(timer);
    timer = null;
  };
  const active = () => current.phase !== "off" && current.phase !== "ended";

  const armSilence = () => {
    clearSilence();
    timer = ports.setTimer(() => {
      timer = null;
      if (current.phase === "listening") stop("silence");
    }, CONVERSATION_SILENCE_MS);
  };

  const listen = (fresh: boolean) => {
    if (fresh) armSilence();
    set({ phase: "listening", ended: undefined });
    ports.listen();
  };

  const stop = (reason: ConversationEnd = "stopped") => {
    if (!active()) return;
    turn++;
    clearSilence();
    ports.stopListening();
    ports.stopSpeaking();
    set({ phase: "ended", ended: reason });
  };

  return {
    state: () => current,
    turn: () => turn,
    hearing() {
      if (current.phase !== "listening") return;
      armSilence();
    },
    start() {
      if (active()) return;
      turn++;
      // Read-aloud is on for a spoken conversation; the owner can mute it.
      current = { phase: "off", muted: false };
      listen(true);
    },
    heard(text) {
      // Only a listening turn accepts words. Late results from a recogniser that
      // has already been stopped, and anything heard while thinking or while a
      // reply is being read, are ignored: the assistant must not send its own
      // speech as a new command. Barge-in is the microphone, which calls interrupt().
      if (current.phase !== "listening" || !text.trim()) return;
      turn++;
      clearSilence();
      ports.stopListening();
      set({ phase: "thinking" });
      ports.send(text.trim());
    },
    listenEnded({ heard, error }) {
      if (current.phase !== "listening" || heard) return;
      if (error && BLOCKED.has(error)) stop("failed");
      // The recogniser gives up on silence sooner than the conversation does: listen on until the timeout.
      else if (timer !== null) listen(false);
      else stop("silence");
    },
    replied(spoken, expectedTurn?: number) {
      if (expectedTurn !== undefined && expectedTurn !== turn) return;
      if (current.phase !== "thinking") return;
      const mine = turn;
      const done = () => {
        if (turn === mine && current.phase === "speaking") listen(true);
      };
      if (spoken && !current.muted) {
        set({ phase: "speaking" });
        if (ports.speak(spoken, done)) return;
      }
      listen(true);
    },
    interrupt() {
      if (current.phase !== "speaking") return;
      turn++;
      ports.stopSpeaking();
      listen(true);
    },
    setMuted(muted) {
      set({ muted });
      if (muted && current.phase === "speaking") {
        turn++;
        ports.stopSpeaking();
        listen(true);
      }
    },
    stop,
    close() {
      stop();
      if (current.phase !== "off") set({ phase: "off", ended: undefined });
    },
  };
}
