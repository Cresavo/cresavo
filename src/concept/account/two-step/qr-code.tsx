"use client";

import { useMemo } from "react";
import { encode } from "uqr";

/** A QR code drawn as SVG, dark on light whatever the theme, so every camera reads it. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { size, path } = useMemo(() => {
    const { data } = encode(value, { ecc: "M", border: 4 });
    const cells = data.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : ""))).join("");
    return { size: data.length, path: cells };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="size-48 rounded-md" shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
