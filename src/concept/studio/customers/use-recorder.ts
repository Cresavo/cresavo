"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MAX_AUDIO_SECONDS, recorderMime } from "../../journals/audio-file";
import { t } from "../../i18n";
import { showToast } from "../../ui/toast";

// Records the microphone with MediaRecorder for the journal. Stops by itself at
// the ten-minute limit. Where MediaRecorder is missing, `supported` is false.

const noSubscription = () => () => {};
const canRecord = () => typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
/** Speech-sized Opus; small enough that ten minutes stays far below the upload limit. */
const BITS_PER_SECOND = 32_000;

function microphoneProblem(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return t("voice.blocked");
  if (name === "NotFoundError" || name === "OverconstrainedError") return t("journal.audio.noMicrophone");
  return t("journal.audio.recordFailed");
}

interface RecorderOptions {
  /** A finished recording: its audio and how long it ran. May return the stored recording id. */
  onRecorded: (audio: Blob, seconds: number) => void | Promise<string | undefined>;
  /** Called whenever recording ends, by Stop or by the time limit. */
  onEnd?: () => void | Promise<void>;
}

export function useRecorder({ onRecorded, onEnd }: RecorderOptions) {
  const supported = useSyncExternalStore(noSubscription, canRecord, () => false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const handlers = useRef({ onRecorded, onEnd });
  const live = useRef(true);
  const tick = useRef<ReturnType<typeof setInterval>>(undefined);
  const limit = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingStop = useRef<((id?: string) => void)[]>([]);
  const saving = useRef<Promise<string | undefined> | null>(null);
  const starting = useRef(false);
  useEffect(() => {
    handlers.current = { onRecorded, onEnd };
  });

  const clearTimers = () => {
    clearInterval(tick.current);
    clearTimeout(limit.current);
    tick.current = undefined;
    limit.current = undefined;
  };

  const finishStop = (id?: string) => {
    const waiters = pendingStop.current;
    pendingStop.current = [];
    waiters.forEach((resolve) => resolve(id));
  };

  const stop = useCallback(() => new Promise<string | undefined>((resolve) => {
    if (recorder.current?.state === "recording") {
      pendingStop.current.push(resolve);
      recorder.current.stop();
    } else if (pendingStop.current.length) {
      pendingStop.current.push(resolve);
    } else if (saving.current) {
      saving.current.then(resolve, () => resolve(undefined));
    } else {
      resolve(undefined);
    }
  }), []);

  // Leaving the journal mid-recording releases the microphone and keeps nothing.
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      clearTimers();
      finishStop();
      const current = recorder.current;
      if (!current) return;
      current.onstop = null;
      if (current.state !== "inactive") current.stop();
      current.stream.getTracks().forEach((track) => track.stop());
      recorder.current = null;
    };
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (starting.current || !canRecord()) return false;
    if (saving.current) await saving.current;
    if (recorder.current || !live.current || !canRecord()) return false;
    starting.current = true;
    try {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      showToast(microphoneProblem(error));
      return false;
    }
    if (!live.current) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    const mimeType = recorderMime((mime) => MediaRecorder.isTypeSupported(mime));
    let next: MediaRecorder;
    try {
      next = new MediaRecorder(stream, { audioBitsPerSecond: BITS_PER_SECOND, ...(mimeType && { mimeType }) });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      showToast(t("journal.audio.recordFailed"));
      return false;
    }
    const chunks: Blob[] = [];
    const startedAt = performance.now();
    tick.current = setInterval(() => setSeconds(Math.floor((performance.now() - startedAt) / 1000)), 1000);
    limit.current = setTimeout(() => {
      showToast(t("journal.audio.autoStopped"));
      void stop();
    }, MAX_AUDIO_SECONDS * 1000);
    next.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    next.onstop = () => {
      clearTimers();
      stream.getTracks().forEach((track) => track.stop());
      recorder.current = null;
      setRecording(false);
      const audio = new Blob(chunks, { type: next.mimeType || mimeType || chunks[0]?.type || "" });
      const length = Math.min((performance.now() - startedAt) / 1000, MAX_AUDIO_SECONDS);
      saving.current = (async () => {
        try {
          await handlers.current.onEnd?.();
          const id = audio.size ? await handlers.current.onRecorded(audio, length) : undefined;
          finishStop(typeof id === "string" ? id : undefined);
          return typeof id === "string" ? id : undefined;
        } catch {
          finishStop();
          return undefined;
        } finally {
          saving.current = null;
        }
      })();
    };
    recorder.current = next;
    setSeconds(0);
    setRecording(true);
    try {
      next.start(1000);
    } catch {
      clearTimers();
      stream.getTracks().forEach((track) => track.stop());
      recorder.current = null;
      setRecording(false);
      showToast(t("journal.audio.recordFailed"));
      return false;
    }
    return true;
    } finally {
      starting.current = false;
    }
  }, [stop]);

  return { supported, recording, seconds, start, stop };
}
