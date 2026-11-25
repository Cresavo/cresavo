"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { locale, t } from "../i18n";
import { showToast } from "../ui/toast";

// Browser speech recognition (Chrome, Edge, Safari). Where it is missing,
// `supported` is false and callers hide their microphone. Where the browser
// can recognise this language on the device, it is asked to (`processLocally`),
// so the audio is not sent to an online service. That is only set once the
// browser says the language pack is already available: forcing it otherwise
// fails with language-not-supported, including on the existing one-phrase and
// dictation microphones. Nothing here records or keeps audio, and language
// packs are never installed on their own.

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
type RecognitionConstructor = (new () => Recognition) & {
  available?: (options: { langs: string[]; processLocally?: boolean }) => Promise<string>;
};

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition;
}

/** What the browser says about on-device recognition for a language, if it can say. */
export type LocalSpeechAvailability = "available" | "downloadable" | "downloading" | "unavailable" | "unknown";

const LOCAL_STATUS = new Set<LocalSpeechAvailability>(["available", "downloadable", "downloading", "unavailable"]);

let localProbe: { lang: string; status: LocalSpeechAvailability } | null = null;

function supportsProcessLocally(Recognizer: RecognitionConstructor): boolean {
  return "processLocally" in Recognizer.prototype || "processLocally" in new Recognizer();
}

/** Whether this browser has the on-device recognition option at all. */
export function recognisesOnDevice(): boolean {
  const Recognizer = recognitionConstructor();
  return !!Recognizer && supportsProcessLocally(Recognizer);
}

/** Last known on-device status for this language, or null when it has not been asked. */
export function localSpeechStatus(lang: string): LocalSpeechAvailability | null {
  return localProbe?.lang === lang ? localProbe.status : null;
}

/**
 * Asks whether this language can already be recognised on the device. Does not
 * download a language pack. Used so `processLocally` is only set when it will work.
 */
export async function probeLocalSpeech(lang: string): Promise<LocalSpeechAvailability> {
  const Recognizer = recognitionConstructor();
  if (!Recognizer || !supportsProcessLocally(Recognizer)) {
    localProbe = { lang, status: "unknown" };
    return "unknown";
  }
  if (typeof Recognizer.available !== "function") {
    localProbe = { lang, status: "unknown" };
    return "unknown";
  }
  try {
    const raw = await Recognizer.available({ langs: [lang], processLocally: true });
    const status = LOCAL_STATUS.has(raw as LocalSpeechAvailability) ? (raw as LocalSpeechAvailability) : "unknown";
    localProbe = { lang, status };
    return status;
  } catch {
    localProbe = { lang, status: "unknown" };
    return "unknown";
  }
}

/** True only when this language is already available to recognise on the device. */
export function usesLocalSpeech(lang: string): boolean {
  return localSpeechStatus(lang) === "available";
}

/**
 * A recogniser for one listening turn, after asking whether this language is
 * already available on the device. The first utterance can then stay on the
 * device when the pack is already there. Does not download a pack.
 */
export async function prepareRecognition(options: { lang: string; continuous: boolean }): Promise<{ recognition: Recognition; onDevice: boolean } | null> {
  if (recognisesOnDevice() && localSpeechStatus(options.lang) === null) await probeLocalSpeech(options.lang);
  return createRecognition(options);
}

/** A recogniser set up for one listening turn, or null where the browser has none. */
export function createRecognition(options: { lang: string; continuous: boolean }): { recognition: Recognition; onDevice: boolean } | null {
  const Recognizer = recognitionConstructor();
  if (!Recognizer) return null;
  const recognition = new Recognizer();
  recognition.lang = options.lang;
  recognition.continuous = options.continuous;
  recognition.interimResults = true;
  // Only when the pack is already there: setting processLocally otherwise fails the turn.
  const onDevice = usesLocalSpeech(options.lang);
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
  /** Called with unfinished words while the person is still speaking. */
  onInterim?: (text: string) => void;
  /** No note when nothing was heard: the caller decides what silence means (a conversation listens again). */
  quietSilence?: boolean;
}

export function useSpeech({ continuous = false, onText, onEnd, onInterim, quietSilence = false }: SpeechOptions) {
  const supported = useSpeechSupported();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const starting = useRef(0);
  const handlers = useRef({ onText, onEnd, onInterim });
  useEffect(() => {
    handlers.current = { onText, onEnd, onInterim };
  });
  useEffect(() => () => {
    starting.current++;
    recognition.current?.abort();
  }, []);

  const stop = useCallback(() => recognition.current?.stop(), []);
  const abort = useCallback(() => {
    starting.current++;
    recognition.current?.abort();
  }, []);

  const start = useCallback(() => {
    if (recognition.current) return;
    const mine = ++starting.current;
    void (async () => {
      const created = await prepareRecognition({ lang: locale, continuous });
      if (starting.current !== mine || recognition.current) return;
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
        if (partial.trim()) handlers.current.onInterim?.(partial.trim());
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
    })();
  }, [continuous, quietSilence]);

  const toggle = useCallback(() => (recognition.current ? stop() : start()), [start, stop]);

  return { supported, listening, interim, start, toggle, stop, abort };
}
