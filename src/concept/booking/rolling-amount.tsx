"use client";

import { useEffect, useState } from "react";
import { formatMinor } from "./policy-summary";

const ROLL_MS = 320;

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Whole major units while rolling when both ends are whole, so the width does not jitter on decimals. */
function between(from: number, to: number, progress: number) {
  const unit = from % 100 === 0 && to % 100 === 0 ? 100 : 1;
  return Math.round((from + (to - from) * progress) / unit) * unit;
}

/**
 * An amount that rolls to its new value when it changes, in tabular figures.
 * The first render shows the real amount; with reduced motion it snaps. While
 * it rolls, assistive technology reads the real amount, not the ticks.
 */
export function RollingAmount({ minor, currency }: { minor: number; currency: string }) {
  const [roll, setRoll] = useState({ from: minor, to: minor });
  const [shown, setShown] = useState(minor);
  if (roll.to !== minor) {
    const snap = reducedMotion();
    setRoll({ from: snap ? minor : shown, to: minor });
    if (snap) setShown(minor);
  }
  useEffect(() => {
    if (roll.from === roll.to) return;
    const began = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / ROLL_MS);
      setShown(progress === 1 ? roll.to : between(roll.from, roll.to, 1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    let frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [roll]);
  const real = formatMinor(minor, currency);
  if (shown === minor) return <span className="tabular-nums">{real}</span>;
  return <span className="tabular-nums"><span aria-hidden>{formatMinor(shown, currency)}</span><span className="sr-only">{real}</span></span>;
}
