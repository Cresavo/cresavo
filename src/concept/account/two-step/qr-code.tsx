"use client";

import { useMemo } from "react";
import { encode } from "uqr";

/** A QR code drawn as SVG, dark on light whatever the theme, so every camera reads it. `lg` is for a longer address read from a counter screen. */
export function QrCode({ value, label, size: shown = "md" }: { value: string; label: string; size?: "md" | "lg" }) {
  const { size, path } = useMemo(() => {
    const { data } = encode(value, { ecc: "M", border: 4 });
    const cells = data.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : ""))).join("");
    return { size: data.length, path: cells };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className={shown === "lg" ? "size-56 rounded-md" : "size-48 rounded-md"} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
