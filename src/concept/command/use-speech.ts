"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { locale, t } from "../i18n";
import { showToast } from "../ui/toast";

// Browser speech recognition (Chrome, Edge, Safari). Where it is missing,
// `supported` is false and callers hide their microphone. Where the browser
// can recognise on the device (`processLocally`), it is asked to, so the audio
// is not sent to an online service; elsewhere the browser's own service is used.
// Nothing here records or keeps audio.

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
export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  /** Recognise on the device only. Chrome 139+; missing elsewhere. */
  processLocally?: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition;
}

/** Whether this browser can be asked to recognise speech on the device. */
export function recognisesOnDevice(): boolean {
  const Recognizer = recognitionConstructor();
  return !!Recognizer && "processLocally" in Recognizer.prototype;
}

/** A recogniser set up for one listening turn, or null where the browser has none. */
export function createRecognition(options: { lang: string; continuous: boolean }): { recognition: Recognition; onDevice: boolean } | null {
  const Recognizer = recognitionConstructor();
  if (!Recognizer) return null;
  const recognition = new Recognizer();
  recognition.lang = options.lang;
  recognition.continuous = options.continuous;
  recognition.interimResults = true;
  const onDevice = "processLocally" in recognition;
  if (onDevice) recognition.processLocally = true;
  return { recognition, onDevice };
}

const noSubscription = () => () => {};

/** Whether this browser can recognise speech. False on the server and in the first render. */
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(noSubscription, () => !!recognitionConstructor(), () => false);
}

/** How a listening turn ended: with words, in silence, stopped, or refused. */
export type SpeechEnd = { heard: boolean; error?: string };

interface SpeechOptions {
  /** Keep listening across pauses (dictation) instead of stopping after one phrase (commands). */
  continuous?: boolean;
  /** Called with each finished piece of speech. */
  onText: (text: string) => void;
  /** Called when a listening turn is over. */
  onEnd?: (end: SpeechEnd) => void;
  /** No note when nothing was heard: the caller decides what silence means (a conversation listens again). */
  quietSilence?: boolean;
}

export function useSpeech({ continuous = false, onText, onEnd, quietSilence = false }: SpeechOptions) {
  const supported = useSpeechSupported();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const handlers = useRef({ onText, onEnd });
  useEffect(() => {
    handlers.current = { onText, onEnd };
  });
  useEffect(() => () => recognition.current?.abort(), []);

  const stop = useCallback(() => recognition.current?.stop(), []);
  const abort = useCallback(() => recognition.current?.abort(), []);

  const start = useCallback(() => {
    if (recognition.current) return;
    const created = createRecognition({ lang: locale, continuous });
    if (!created) return;
    const next = created.recognition;
    let heard = false;
    let failure: string | undefined;
    next.onresult = (event) => {
      let finished = "";
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finished += result[0].transcript;
        else partial += result[0].transcript;
      }
      setInterim(partial);
      if (finished.trim()) {
        heard = true;
        handlers.current.onText(finished.trim());
      }
    };
    next.onerror = ({ error }) => {
      failure = error;
      if (error === "not-allowed" || error === "service-not-allowed") showToast(t("voice.blocked"));
      else if (error === "language-not-supported" && created.onDevice) showToast(t("voice.notOnDevice"));
      else if (error === "no-speech") {
        if (!quietSilence) showToast(t("voice.noSpeech"));
      } else if (error !== "aborted") showToast(t("voice.failed"));
    };
    next.onend = () => {
      if (recognition.current === next) recognition.current = null;
      setListening(false);
      setInterim("");
      handlers.current.onEnd?.({ heard, error: failure });
    };
    recognition.current = next;
    setListening(true);
    try {
      next.start();
    } catch {
      // Already listening elsewhere or blocked: the turn ends at once.
      recognition.current = null;
      setListening(false);
      handlers.current.onEnd?.({ heard: false, error: "failed" });
    }
  }, [continuous, quietSilence]);

  const toggle = useCallback(() => (recognition.current ? stop() : start()), [start, stop]);

  return { supported, listening, interim, start, toggle, stop, abort };
}
