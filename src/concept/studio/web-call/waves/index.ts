export type WaveKind = "bars" | "ribbon" | "springs" | "ring";

export const WAVE_KINDS: readonly WaveKind[] = ["bars", "ribbon", "springs", "ring"];

export function isWaveKind(value: string | null | undefined): value is WaveKind {
  return value === "bars" || value === "ribbon" || value === "springs" || value === "ring";
}

export { RibbonWave } from "./ribbon";
export { SpringWave } from "./springs";
export { RingWave } from "./ring";
