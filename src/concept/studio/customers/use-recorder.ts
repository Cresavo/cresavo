"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AUDIO_TIMESLICE_MS, elapsedSeconds, liveChunkAction, liveRecordingDuration, reachedAudioLimit } from "../../journals/audio-limit";
import { MAX_AUDIO_SECONDS, recorderMime } from "../../journals/audio-file";
import { t } from "../../i18n";
import { showToast } from "../../ui/toast";
import { waitToStart } from "./in-flight";

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
  const onVisible = useRef<(() => void) | undefined>(undefined);
  const pendingStop = useRef<((id?: string) => void)[]>([]);
  const saving = useRef<Promise<string | undefined> | null>(null);
  const starting = useRef(false);
  const startGen = useRef(0);
  useEffect(() => {
    handlers.current = { onRecorded, onEnd };
  });

  const clearTimers = () => {
    clearInterval(tick.current);
    clearTimeout(limit.current);
    tick.current = undefined;
    limit.current = undefined;
    if (onVisible.current) {
      document.removeEventListener("visibilitychange", onVisible.current);
      onVisible.current = undefined;
    }
  };

  const finishStop = (id?: string) => {
    const waiters = pendingStop.current;
    pendingStop.current = [];
    waiters.forEach((resolve) => resolve(id));
  };

  const stop = useCallback(() => new Promise<string | undefined>((resolve) => {
    startGen.current += 1;
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
      startGen.current += 1;
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
    if (!canRecord()) return false;
    const gen = startGen.current;
    if (!(await waitToStart(starting, saving))) return false;
    try {
    if (gen !== startGen.current || recorder.current || !live.current || !canRecord()) return false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      showToast(microphoneProblem(error));
      return false;
    }
    if (!live.current || gen !== startGen.current) {
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
    const startedAt = Date.now();
    let hitLimit = false;
    const atLimit = () => {
      if (hitLimit) return;
      hitLimit = true;
      showToast(t("journal.audio.autoStopped"));
      void stop();
    };
    tick.current = setInterval(() => setSeconds(Math.floor(elapsedSeconds(startedAt))), 1000);
    limit.current = setTimeout(() => { if (reachedAudioLimit(startedAt)) atLimit(); }, MAX_AUDIO_SECONDS * 1000);
    onVisible.current = () => { if (reachedAudioLimit(startedAt)) atLimit(); };
    document.addEventListener("visibilitychange", onVisible.current);
    next.ondataavailable = (event) => {
      const action = liveChunkAction(startedAt, next.state, event.data.size);
      if (action.keep) chunks.push(event.data);
      if (action.stop) atLimit();
    };
    next.onstop = () => {
      clearTimers();
      stream.getTracks().forEach((track) => track.stop());
      recorder.current = null;
      setRecording(false);
      const audio = new Blob(chunks, { type: next.mimeType || mimeType || chunks[0]?.type || "" });
      const duration = liveRecordingDuration(startedAt);
      if (!duration.ok && !hitLimit) showToast(t("journal.audio.autoStopped"));
      saving.current = (async () => {
        try {
          await handlers.current.onEnd?.();
          const id = audio.size && duration.ok ? await handlers.current.onRecorded(audio, duration.seconds) : undefined;
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
      next.start(AUDIO_TIMESLICE_MS);
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
