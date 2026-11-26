"use client";

import { useEffect, useRef, type RefObject } from "react";
import { cx } from "../../../ui/cx";
import type { CallLevels } from "../use-call-audio";
import { inkOf, prefersReducedMotion, resizeCanvas } from "./canvas";

// Fine mirrored bars with spring physics. The upper half follows Maja,
// the lower half follows the caller — same ink, different weight.
// Denser and more physical than the current preview bars.

const BARS = 72;
const STIFFNESS = 0.22;
const DAMPING = 0.72;

export function SpringWave({
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
  const majaPos = useRef(new Float32Array(BARS));
  const majaVel = useRef(new Float32Array(BARS));
  const callerPos = useRef(new Float32Array(BARS));
  const callerVel = useRef(new Float32Array(BARS));
  const clock = useRef(0);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const reduce = prefersReducedMotion();
    let frame = 0;

    const step = (pos: Float32Array, vel: Float32Array, target: number, i: number) => {
      const current = pos[i] ?? 0;
      const velocity = (vel[i] ?? 0) + (target - current) * STIFFNESS;
      const nextVel = velocity * DAMPING;
      const next = current + nextVel;
      vel[i] = nextVel;
      pos[i] = next;
      return next;
    };

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
      const bins = current?.bins;
      const mid = height / 2;
      if (!reduce) clock.current += ringing ? 0.08 : 0.03;
      const gap = 1;
      const barWidth = Math.max(1, (width - gap * (BARS - 1)) / BARS);
      const maxH = mid - 2;

      for (let i = 0; i < BARS; i += 1) {
        const u = i / (BARS - 1);
        const envelope = Math.sin(u * Math.PI);
        const bin = bins && bins.length ? bins[Math.floor(u * (bins.length - 1))]! / 255 : 0;
        const neighbour = bins && bins.length ? bins[Math.min(bins.length - 1, Math.floor(u * (bins.length - 1)) + 2)]! / 255 : 0;
        const pulse = ringing ? 0.18 + 0.08 * Math.sin(clock.current + u * 6) : 0.05;
        let majaTarget = pulse * envelope;
        let callerTarget = pulse * 0.6 * envelope;
        if (active && !reduce) {
          majaTarget = Math.min(1, (0.08 + maja * 0.85 + bin * 0.7 * (0.4 + maja)) * envelope);
          callerTarget = Math.min(1, (0.06 + caller * 0.9 + neighbour * 0.65 * (0.35 + caller)) * envelope);
        } else if (reduce) {
          majaTarget = 0.12 * envelope;
          callerTarget = 0.08 * envelope;
        }
        if (reduce) {
          majaPos.current[i] = majaTarget;
          callerPos.current[i] = callerTarget;
        } else {
          step(majaPos.current, majaVel.current, majaTarget, i);
          step(callerPos.current, callerVel.current, callerTarget, i);
        }
        const x = i * (barWidth + gap) + barWidth / 2;
        const up = Math.max(2, (majaPos.current[i] ?? 0) * maxH);
        const down = Math.max(2, (callerPos.current[i] ?? 0) * maxH);
        ctx.strokeStyle = color;
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(1.15, barWidth * 0.7);
        ctx.globalAlpha = 0.45 + 0.55 * (majaPos.current[i] ?? 0);
        ctx.beginPath();
        ctx.moveTo(x, mid);
        ctx.lineTo(x, mid - up);
        ctx.stroke();
        ctx.globalAlpha = 0.4 + 0.55 * (callerPos.current[i] ?? 0);
        ctx.beginPath();
        ctx.moveTo(x, mid);
        ctx.lineTo(x, mid + down);
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
