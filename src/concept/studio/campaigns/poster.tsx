import { useId, type Ref } from "react";
import type { CampaignPoster, PosterFormat } from "../../data/types";
import { fitFontSize, POSTER_FORMATS, wrapText } from "../../campaigns/poster-layout";

// Template posters built from the salon's own photos and colours: no AI image.
// Layouts are written in poster pixels (see POSTER_FORMATS) so the exported PNG
// is exactly what is shown.

const FONT = "Inter, -apple-system, 'Segoe UI', sans-serif";
const GREEN = "#2F5D50";
const CREAM = "#F7F1E8";
const SAND = "#EFE6D8";
const INK = "#1F2A26";
const NIGHT = "#1D2724";
const TERRACOTTA = "#E2A07C";

interface PosterProps {
  poster: CampaignPoster;
  format: PosterFormat;
  /** Small line above the headline, e.g. the campaign name. */
  kicker: string;
  /** "Until 8 Nov". */
  until: string;
  /** Salon name, address and booking link. */
  footer: string[];
  label: string;
  ref?: Ref<SVGSVGElement>;
}

interface Item {
  lines: string[];
  size: number;
  weight?: number;
  fill: string;
  spacing?: number;
  /** Space above this block. */
  gap?: number;
}

const LINE_HEIGHT = 1.18;

/** Where each block starts when the blocks are stacked downwards from `y`. */
function stackTops(items: Item[], y: number): number[] {
  const tops: number[] = [];
  let cursor = y;
  for (const item of items) {
    cursor += item.gap ?? 0;
    tops.push(cursor);
    cursor += item.lines.length * item.size * LINE_HEIGHT;
  }
  return tops;
}

function stackHeight(items: Item[]): number {
  return items.reduce((sum, item) => sum + (item.gap ?? 0) + item.lines.length * item.size * LINE_HEIGHT, 0);
}

/** Text blocks stacked from `y` downwards. */
function Stack({ items, x, y, anchor = "start" }: { items: Item[]; x: number; y: number; anchor?: "start" | "middle" }) {
  const tops = stackTops(items, y);
  return (
    <>
      {items.map((item, index) => (
        <text key={index} x={x} y={tops[index]} textAnchor={anchor} fontSize={item.size} fontWeight={item.weight ?? 400} fill={item.fill} letterSpacing={item.spacing}>
          {item.lines.map((line, i) => (
            <tspan key={i} x={x} dy={i === 0 ? item.size : item.size * LINE_HEIGHT}>
              {line}
            </tspan>
          ))}
        </text>
      ))}
    </>
  );
}

export function Poster({ poster, format, kicker, until, footer, label, ref }: PosterProps) {
  const { width: W, height: H } = POSTER_FORMATS[format];
  const id = useId();
  const margin = Math.round(W * 0.08);
  const inner = W - margin * 2;
  // Instagram covers the top and bottom of a story with its own buttons.
  const top = format === "story" ? 250 : 0;
  const bottom = H - (format === "story" ? 340 : 0);
  const headlineSize = fitFontSize(poster.headline, inner, Math.round(W * 0.15));
  const text = (light: boolean, align: "start" | "middle", accent: string): Item[] => [
    { lines: wrapText(kicker.toUpperCase(), 30, 2), size: 32, weight: 600, fill: accent, spacing: 3 },
    { lines: [poster.headline], size: headlineSize, weight: 800, fill: light ? "#FFFFFF" : INK, gap: 18 },
    { lines: wrapText(poster.detail, align === "middle" ? 26 : 30, 3), size: 50, weight: 600, fill: light ? "#FFFFFF" : INK, gap: 8 },
    { lines: [until], size: 36, fill: light ? "#E6DFD3" : "#4A524D", gap: 18 },
  ];
  const foot = (fill: string): Item[] => [{ lines: footer.flatMap((line) => wrapText(line, 52, 2)), size: 30, fill }];
  const footerY = bottom - margin * 0.9 - footer.length * 40;
  const image = poster.image;
  // Styles that end with a text block anchor it above the footer, so long texts grow upwards.
  const bodyY = (items: Item[]) => footerY - 50 - stackHeight(items);
  const calmItems = text(false, "start", GREEN);
  const archItems = text(false, "middle", GREEN);
  const archBottom = bodyY(archItems) - 50;
  const archTop = top + H * 0.04;
  const archR = W * 0.3;
  const archPath = (pad: number) =>
    `M ${W * 0.2 - pad} ${archBottom + pad} V ${archTop + archR - pad} A ${archR + pad} ${archR + pad} 0 0 1 ${W * 0.8 + pad} ${archTop + archR - pad} V ${archBottom + pad} Z`;
  const photoH = bodyY(calmItems) - 40;
  const photoItems = text(true, "start", "#F7F1E8");

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      className="h-auto w-full"
      style={{ fontFamily: FONT }}
    >
      <defs>
        <clipPath id={`${id}-arch`}>
          <path d={archPath(0)} />
        </clipPath>
        <clipPath id={`${id}-circle`}>
          <circle cx={W / 2} cy={top + W * 0.3} r={W * 0.25} />
        </clipPath>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.3" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.78" />
        </linearGradient>
      </defs>

      {poster.style === "calm" && (
        <>
          <rect width={W} height={H} fill={CREAM} />
          <image href={image} x={0} y={0} width={W} height={photoH} preserveAspectRatio="xMidYMid slice" />
          <Stack x={margin} y={bodyY(calmItems)} items={calmItems} />
          <line x1={margin} x2={W - margin} y1={footerY - 24} y2={footerY - 24} stroke="#D9CFC0" strokeWidth={2} />
          <Stack x={margin} y={footerY} items={foot("#6E716A")} />
        </>
      )}

      {poster.style === "bold" && (
        <>
          <rect width={W} height={H} fill={GREEN} />
          <circle cx={W * 0.86} cy={top + H * 0.1} r={W * 0.3} fill="#E3EEE8" opacity={0.12} />
          <Stack x={margin} y={top + margin} items={text(true, "start", "#CFE3D9")} />
          <image href={image} x={0} y={top + (bottom - top) * 0.52} width={W} height={(bottom - top) * 0.3} preserveAspectRatio="xMidYMid slice" />
          <Stack x={margin} y={footerY} items={foot("#CFE3D9")} />
        </>
      )}

      {poster.style === "photo" && (
        <>
          <image href={image} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice" />
          <rect width={W} height={H} fill={`url(#${id}-shade)`} />
          <Stack x={margin} y={bodyY(photoItems)} items={photoItems} />
          <Stack x={margin} y={footerY} items={foot("#E6DFD3")} />
        </>
      )}

      {poster.style === "arch" && (
        <>
          <rect width={W} height={H} fill={SAND} />
          <path d={archPath(18)} fill="none" stroke={GREEN} strokeWidth={3} />
          <image href={image} x={W * 0.2} y={archTop} width={W * 0.6} height={archBottom - archTop} clipPath={`url(#${id}-arch)`} preserveAspectRatio="xMidYMid slice" />
          <Stack x={W / 2} y={bodyY(archItems)} anchor="middle" items={archItems} />
          <Stack x={W / 2} y={footerY} anchor="middle" items={foot("#6E716A")} />
        </>
      )}

      {poster.style === "dusk" && (
        <>
          <rect width={W} height={H} fill={NIGHT} />
          <image href={image} x={W * 0.25} y={top + W * 0.05} width={W * 0.5} height={W * 0.5} clipPath={`url(#${id}-circle)`} preserveAspectRatio="xMidYMid slice" />
          <circle cx={W / 2} cy={top + W * 0.3} r={W * 0.25 + 14} fill="none" stroke={TERRACOTTA} strokeWidth={3} />
          <Stack x={W / 2} y={top + W * 0.3 + W * 0.25 + H * 0.04} anchor="middle" items={text(true, "middle", TERRACOTTA)} />
          <Stack x={W / 2} y={footerY} anchor="middle" items={foot("#B9BDB6")} />
        </>
      )}
    </svg>
  );
}
