"use client";

import { useEffect, useRef, type RefObject } from "react";
import { t } from "../../../i18n";
import { cx } from "../../../ui/cx";
import { MajaPortrait } from "../maja-portrait";
import type { CallLevels } from "../use-call-audio";
import { inkOf, prefersReducedMotion, resizeCanvas } from "./canvas";

// A flat solid-ink organic ring around Maja's portrait. The outline
// deforms with her voice; a thinner inner ring answers the caller.
// Approach from voice-orb and ElevenLabs orb references, restyled:
// one solid colour, no glow, no glass, no candy gradient.

const STEPS = 240;

export function RingWave({
  levels,
  active,
  muted,
  ringing,
  portrait = true,
  compact,
  className,
}: {
  levels: RefObject<CallLevels>;
  active: boolean;
  muted?: boolean;
  ringing?: boolean;
  portrait?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef(0);

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
      if (!reduce) clock.current += 0.02 + maja * 0.03 + (ringing ? 0.015 : 0);
      const t = clock.current;
      const cx0 = width / 2;
      const cy0 = height / 2;
      const room = Math.min(width, height) / 2;
      const breathe = ringing && !reduce ? 1 + 0.03 * Math.sin(t * 1.6) : 1;
      const hole = room * 0.76;
      const band = room * (0.09 + maja * 0.05 + (ringing ? 0.02 : 0));
      const base = (hole + band) * breathe;
      const deform = reduce ? 0 : 0.016 + maja * 0.09;
      const callerWobble = reduce ? 0 : caller * 0.08;

      const outer = (angle: number) => {
        const n =
          Math.sin(angle * 2 + t * 0.85) * 0.7 +
          Math.sin(angle * 3 - t * 0.6) * 0.3;
        return base * (1 + deform * n);
      };

      ctx.beginPath();
      for (let i = 0; i <= STEPS; i += 1) {
        const angle = (i / STEPS) * Math.PI * 2;
        const r = outer(angle);
        const x = cx0 + Math.cos(angle) * r;
        const y = cy0 + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      // Cut a circular hole for the portrait.
      ctx.moveTo(cx0 + hole, cy0);
      ctx.arc(cx0, cy0, hole, 0, Math.PI * 2, true);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.92;
      ctx.fill("evenodd");

      if (callerWobble > 0.01 || (!reduce && active)) {
        ctx.beginPath();
        const inner = hole + room * (0.04 + callerWobble * 0.12);
        for (let i = 0; i <= STEPS; i += 1) {
          const angle = (i / STEPS) * Math.PI * 2;
          const n = Math.sin(angle * 8 + t * 1.8) * callerWobble;
          const r = inner * (1 + n);
          const x = cx0 + Math.cos(angle) * r;
          const y = cy0 + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.55 + caller * 0.35;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [active, levels, muted, ringing]);

  return (
    <div
      className={cx("relative shrink-0 text-action", compact ? "size-24" : "size-32", className)}
      aria-hidden
    >
      <canvas ref={canvas} className="absolute inset-0 size-full" />
      <div className={cx("absolute left-1/2 top-1/2 overflow-hidden rounded-full bg-action-bg", compact ? "size-16 -translate-x-1/2 -translate-y-1/2" : "size-24 -translate-x-1/2 -translate-y-1/2")}>
        {portrait ? (
          <MajaPortrait />
        ) : (
          <div className="flex size-full items-center justify-center font-medium text-h2 text-text">
            {t("webCall.monogram")}
          </div>
        )}
      </div>
    </div>
  );
}
