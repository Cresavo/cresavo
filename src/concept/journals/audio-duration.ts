import type { DurationProbe } from "./audio-file";

const PROBE_TIMEOUT_MS = 10_000;

/**
 * Reads a recording's length with a detached audio element. A WebM without a
 * duration in its header reports Infinity until the element seeks to the end,
 * so it is asked to seek far ahead once. NaN when the browser cannot decode it.
 */
export const probeDuration: DurationProbe = (blob, mime) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(blob.type === mime ? blob : new Blob([blob], { type: mime }));
    const audio = new Audio();
    let done = false;
    const finish = (seconds: number) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    const timer = setTimeout(() => finish(Number.NaN), PROBE_TIMEOUT_MS);
    audio.preload = "metadata";
    audio.onerror = () => finish(Number.NaN);
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) return finish(audio.duration);
      audio.ondurationchange = () => {
        if (Number.isFinite(audio.duration)) finish(audio.duration);
      };
      audio.currentTime = Number.MAX_SAFE_INTEGER;
    };
    audio.src = url;
  });
