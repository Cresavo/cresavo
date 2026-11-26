import { MAX_AUDIO_SECONDS } from "./audio-file";

/** MediaRecorder timeslice for a live journal recording, in milliseconds. */
export const AUDIO_TIMESLICE_MS = 1000;
const GRACE_SECONDS = AUDIO_TIMESLICE_MS / 1000;

/** Wall-clock seconds since recording started (`startedAt` is `Date.now()`). */
export const elapsedSeconds = (startedAt: number, now = Date.now()) => Math.max(0, (now - startedAt) / 1000);

/** True once the ten-minute limit has been reached, so the recorder must stop now. */
export const reachedAudioLimit = (startedAt: number, now = Date.now()) => elapsedSeconds(startedAt, now) >= MAX_AUDIO_SECONDS;

/**
 * A live take is kept with its real duration if it did not run past the limit
 * (one timeslice of grace, so a prompt stop is not rejected). Longer takes are refused.
 */
export function liveRecordingDuration(startedAt: number, now = Date.now()): { ok: true; seconds: number } | { ok: false } {
  const seconds = elapsedSeconds(startedAt, now);
  if (seconds > MAX_AUDIO_SECONDS + GRACE_SECONDS) return { ok: false };
  return { ok: true, seconds };
}

/**
 * A dataavailable event during a live take. Chunks are always kept (including the
 * flush MediaRecorder sends after stop()). Stop only while still recording and over
 * the limit; whether the take is stored is decided later from the wall clock.
 */
export function liveChunkAction(
  startedAt: number,
  recorderState: string,
  byteLength: number,
  now = Date.now(),
): { keep: boolean; stop: boolean } {
  return {
    keep: byteLength > 0,
    stop: recorderState === "recording" && reachedAudioLimit(startedAt, now),
  };
}
