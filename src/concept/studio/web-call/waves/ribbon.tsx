"use client";

import { useEffect, useRef, type RefObject } from "react";
import { cx } from "../../../ui/cx";
import type { CallLevels } from "../use-call-audio";
import { inkOf, prefersReducedMotion, resizeCanvas } from "./canvas";

// A calm, Siri-like ribbon of flowing sine lines in a single brand ink.
// Approach inspired by Apple Voice Mode / David Haz's Strands and by
// react-ai-voice-visualizer VoiceWave (MIT): several phase-shifted
// curves, not bars. Drawn original here: no glow, no gradient, no glass.

const LINES = 5;
const POINTS = 160;

export function RibbonWave({
  levels,
  active,
  muted,
  ringing,
  className,
}: {
  levels: RefObject<CallLevels>;
  active: boolean;
  muted?: boolean;
  ringing?: boolean;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const phase = useRef(0);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const reduce = prefersReducedMotion();
    let frame = 0;

    const draw = () => {
      const sized = resizeCanvas(node);
      if (!sized) {
        frame = window.requestAnimationFrame(draw);
        return;
      }
      const { ctx, width, height } = sized;
      ctx.clearRect(0, 0, width, height);
      const color = inkOf(node);
      const current = levels.current;
      const maja = current?.maja ?? 0;
      const caller = muted ? 0 : current?.caller ?? 0;
      const mid = height / 2;
      const idle = ringing ? 0.22 : 0.07;
      const energy = active ? Math.max(idle, maja * 0.9 + caller * 0.45) : idle;
      if (!reduce) {
        phase.current += 0.016 + energy * 0.028 + (ringing ? 0.012 : 0);
      }
      const t = phase.current;
      const amp = height * (0.14 + energy * 0.5);

      for (let line = 0; line < LINES; line += 1) {
        const shift = line * 0.42;
        const depth = line / (LINES - 1);
        const localAmp = amp * (0.45 + 0.55 * (1 - Math.abs(depth - 0.55)));
        const callerPull = caller * 0.22 * Math.sin(t * 0.7 + shift);
        ctx.beginPath();
        for (let i = 0; i <= POINTS; i += 1) {
          const u = i / POINTS;
          const x = u * width;
          const envelope = Math.sin(u * Math.PI);
          const y =
            mid +
            envelope *
              localAmp *
              (0.62 * Math.sin(u * 7.2 + t + shift) +
                0.28 * Math.sin(u * 13.5 - t * 1.15 + shift * 0.6) +
                0.16 * Math.sin(u * 3.4 + t * 0.5) +
                callerPull * Math.sin(u * 9 + t * 0.9));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.18 + 0.7 * (1 - depth * 0.75);
        ctx.lineWidth = 1.25 + (1 - depth) * 1.35;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [active, levels, muted, ringing]);

  return <canvas ref={canvas} className={cx("h-24 w-full text-action", className)} aria-hidden />;
}
