/** Shared timing and WebAudio level helpers for the public call screen. */

export function callClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`;
}

/** RMS of time-domain analyser data, 0–1. */
export function rmsLevel(data: Uint8Array): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (const value of data) {
    const n = (value - 128) / 128;
    sum += n * n;
  }
  return Math.min(1, Math.sqrt(sum / data.length));
}

/** Fast attack, slower release, so the wave follows speech without flicker. */
export function smoothLevel(previous: number, next: number, attack = 0.5, release = 0.18) {
  const rate = next > previous ? attack : release;
  return previous + (next - previous) * rate;
}
