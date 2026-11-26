"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { InputMode, Reply } from "../../assistant/thread";
import { useSpeech, type SpeechEnd } from "../../command/use-speech";
import { useLabFlag } from "../../labs/flags";
import { currentState } from "../../store";
import { createConversation, type ConversationEnd, type ConversationState } from "./conversation";
import { canSpeak, speak, stopSpeaking } from "./speak";
import { spokenReply } from "./spoken-text";

type Send = (text: string, via: InputMode, talk: (reply: Reply | null) => void) => void;
type Recogniser = { start(): void; abort(): void };

/** The conversation wired to this browser's recogniser and speech synthesis. `bind` hands it the latest of both. */
function browserConversation(onChange: (state: ConversationState) => void) {
  let send: Send | null = null;
  let recogniser: Recogniser | null = null;
  /** A recogniser is running; a new turn waits for it to finish before listening again. */
  let recognising = false;
  let restart = false;
  const listen = () => {
    recognising = true;
    recogniser?.start();
  };
  const conversation = createConversation({
    listen: () => {
      if (recognising) restart = true;
      else listen();
    },
    stopListening: () => {
      restart = false;
      recogniser?.abort();
    },
    speak: (text, done) => canSpeak() && speak(text, done),
    stopSpeaking,
    send: (text) => {
      if (!send) return conversation.replied(null);
      const mine = conversation.turn();
      send(text, "voice", (reply) => {
        if (conversation.turn() !== mine) return;
        const saved = currentState();
        conversation.replied(reply && saved ? spokenReply(reply, saved) : null, mine);
      });
    },
    setTimer: (run, ms) => window.setTimeout(run, ms),
    clearTimer: (handle) => window.clearTimeout(handle as number),
    onChange,
  });
  return {
    conversation,
    bind(nextSend: Send, nextRecogniser: Recogniser) {
      send = nextSend;
      recogniser = nextRecogniser;
    },
    /** The recogniser finished a turn. */
    ended(end: SpeechEnd) {
      recognising = false;
      if (!restart) return conversation.listenEnded(end);
      restart = false;
      listen();
    },
  };
}

/**
 * The spoken conversation in the assistant panel, when the Labs switch is on and the browser can listen.
 * `enabled` is false otherwise, and the panel keeps its one-phrase microphone.
 */
export function useConversation(send: Send, assistantOn: boolean) {
  const labOn = useLabFlag("voiceAssistant");
  const [state, setState] = useState<ConversationState>({ phase: "off", muted: false });
  const [browser] = useState(() => browserConversation(setState));
  const { conversation } = browser;
  const speech = useSpeech({
    quietSilence: true,
    onText: (heard) => conversation.heard(heard),
    onInterim: () => conversation.hearing(),
    onEnd: browser.ended,
  });
  // Before any effect of the panel, which may start listening as it opens.
  useLayoutEffect(() => browser.bind(send, speech));

  const enabled = labOn && assistantOn && speech.supported;

  // Leaving the tab ends the conversation and silences any reply: the microphone is never live in the background.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      stopSpeaking();
      conversation.stop("hidden");
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [conversation]);

  useEffect(() => () => conversation.close(), [conversation]);
  useEffect(() => {
    if (!enabled) conversation.close();
  }, [enabled, conversation]);

  const active = state.phase !== "off" && state.phase !== "ended";
  /** The microphone: starts talking, interrupts a reply being read, or stops. */
  const press = useCallback(() => {
    const { phase } = conversation.state();
    if (phase === "speaking") conversation.interrupt();
    else if (phase === "listening" || phase === "thinking") conversation.stop();
    else conversation.start();
  }, [conversation]);

  return {
    enabled,
    phase: state.phase,
    muted: state.muted,
    ended: state.ended as ConversationEnd | undefined,
    active,
    interim: speech.interim,
    listening: speech.listening,
    press,
    start: conversation.start,
    stop: () => conversation.stop(),
    interrupt: conversation.interrupt,
    setMuted: conversation.setMuted,
    close: conversation.close,
  };
}

export type { TalkControls as ConversationControls } from "./talk-controls";
