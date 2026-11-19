"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { locale, t } from "../i18n";
import { showToast } from "../ui/toast";

// Browser speech recognition (Chrome, Edge, Safari). Where it is missing,
// `supported` is false and callers hide their microphone.

interface Alternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  [index: number]: Alternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | undefined {
  const host = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition;
}

const noSubscription = () => () => {};

interface SpeechOptions {
  /** Keep listening across pauses (dictation) instead of stopping after one phrase (commands). */
  continuous?: boolean;
  /** Called with each finished piece of speech. */
  onText: (text: string) => void;
}

export function useSpeech({ continuous = false, onText }: SpeechOptions) {
  const supported = useSyncExternalStore(noSubscription, () => !!recognitionConstructor(), () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const handler = useRef(onText);
  useEffect(() => {
    handler.current = onText;
  });
  useEffect(() => () => recognition.current?.abort(), []);

  const stop = useCallback(() => recognition.current?.stop(), []);

  const start = useCallback(() => {
    const Recognizer = recognitionConstructor();
    if (!Recognizer || recognition.current) return;
    const next = new Recognizer();
    next.lang = locale;
    next.continuous = continuous;
    next.interimResults = true;
    next.onresult = (event) => {
      let finished = "";
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finished += result[0].transcript;
        else partial += result[0].transcript;
      }
      setInterim(partial);
      if (finished.trim()) handler.current(finished.trim());
    };
    next.onerror = ({ error }) => {
      if (error === "not-allowed" || error === "service-not-allowed") showToast(t("voice.blocked"));
      else if (error === "no-speech") showToast(t("voice.noSpeech"));
      else if (error !== "aborted") showToast(t("voice.failed"));
    };
    next.onend = () => {
      recognition.current = null;
      setListening(false);
      setInterim("");
    };
    recognition.current = next;
    setListening(true);
    next.start();
  }, [continuous]);

  const toggle = useCallback(() => (recognition.current ? stop() : start()), [start, stop]);

  return { supported, listening, interim, start, toggle, stop };
}
