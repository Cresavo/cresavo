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
  /** A finished recording: its audio and how long it ran. */
  onRecorded: (audio: Blob, seconds: number) => void;
  /** Called whenever recording ends, by Stop or by the time limit. */
  onEnd?: () => void;
}

export function useRecorder({ onRecorded, onEnd }: RecorderOptions) {
  const supported = useSyncExternalStore(noSubscription, canRecord, () => false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const handlers = useRef({ onRecorded, onEnd });
  useEffect(() => {
    handlers.current = { onRecorded, onEnd };
  });

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  // Leaving the journal mid-recording releases the microphone and keeps nothing.
  useEffect(() => () => {
    const current = recorder.current;
    if (!current) return;
    current.onstop = null;
    if (current.state !== "inactive") current.stop();
    current.stream.getTracks().forEach((track) => track.stop());
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (recorder.current || !canRecord()) return false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      showToast(microphoneProblem(error));
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
    const tick = setInterval(() => setSeconds(Math.floor((performance.now() - startedAt) / 1000)), 1000);
    const limit = setTimeout(() => {
      showToast(t("journal.audio.autoStopped"));
      stop();
    }, MAX_AUDIO_SECONDS * 1000);
    next.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    next.onstop = () => {
      clearInterval(tick);
      clearTimeout(limit);
      stream.getTracks().forEach((track) => track.stop());
      recorder.current = null;
      setRecording(false);
      const audio = new Blob(chunks, { type: next.mimeType || mimeType || chunks[0]?.type || "" });
      const length = Math.min((performance.now() - startedAt) / 1000, MAX_AUDIO_SECONDS);
      handlers.current.onEnd?.();
      if (audio.size) handlers.current.onRecorded(audio, length);
    };
    recorder.current = next;
    setSeconds(0);
    setRecording(true);
    next.start(1000);
    return true;
  }, [stop]);

  return { supported, recording, seconds, start, stop };
}
