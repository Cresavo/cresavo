"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { CallLevels } from "./use-call-audio";
import { cx } from "../../ui/cx";

// A calm, token-coloured bar wave for the call with Maja.
// The approach (canvas bars driven by live WebAudio levels and frequency
// bins) follows open-source voice visualizers, adapted to Cresavo's rules:
// no glow, no gradient, no glass, one solid ink, and a still mark when the
// caller prefers reduced motion.
// References (inspiration and approach only; this file is original):
// - Pipecat Voice UI Kit, BSD-2-Clause: https://github.com/pipecat-ai/voice-ui-kit
// - react-ai-voice-visualizer Waveform, MIT: https://github.com/chevgan/react-ai-voice-visualizer
// - Deepgram UI LiveWaveform, MIT: https://github.com/deepgram/ui

const BARS = 28;

export function CallVisualizer({
  levels,
  active,
  muted,
  className,
}: {
  levels: RefObject<CallLevels>;
  active: boolean;
  muted?: boolean;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const heights = useRef(new Float32Array(BARS));

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    const draw = () => {
      const ctx = node.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = node.clientWidth;
      const height = node.clientHeight;
      if (node.width !== Math.round(width * dpr) || node.height !== Math.round(height * dpr)) {
        node.width = Math.round(width * dpr);
        node.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const color = getComputedStyle(node).color;
      ctx.fillStyle = color;

      const gap = 3;
      const barWidth = Math.max(2, (width - gap * (BARS - 1)) / BARS);
      const mid = height / 2;
      const current = levels.current;
      const majaLevel = current?.maja ?? 0;
      const callerLevel = muted ? 0 : current?.caller ?? 0;
      const bins = current?.bins;
      const energy = Math.max(majaLevel, callerLevel * 0.7);

      for (let i = 0; i < BARS; i += 1) {
        let target = 0.08;
        if (reduce) {
          target = 0.12;
        } else if (active) {
          const bin = bins && bins.length ? bins[Math.floor((i / BARS) * bins.length)]! / 255 : 0;
          const envelope = 0.35 + 0.65 * Math.sin((i / (BARS - 1)) * Math.PI);
          target = Math.min(1, (0.1 + energy * 0.55 + bin * 0.7 * (0.4 + energy)) * envelope);
        }
        const current = heights.current[i] ?? 0;
        const next = current + (target - current) * (reduce ? 1 : 0.28);
        heights.current[i] = next;
        const barHeight = Math.max(4, next * (height - 4));
        const x = i * (barWidth + gap);
        const y = mid - barHeight / 2;
        const radius = Math.min(barWidth / 2, 2);
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.globalAlpha = 0.55 + 0.45 * Math.min(1, (heights.current[i] ?? 0));
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [active, levels, muted]);

  return (
    <canvas
      ref={canvas}
      className={cx("h-16 w-full text-action", className)}
      width={280}
      height={64}
      aria-hidden
    />
  );
}
