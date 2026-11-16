import type { Holiday, Salon } from "../../data/types";
import { t } from "../../i18n";
import { formatDayLong } from "../../i18n/format";

export type PosterStyle = "calm" | "bold" | "photo";

interface PosterProps {
  holiday: Holiday;
  salon: Salon;
  /** Big headline, e.g. "−15%". */
  offer: string;
  /** Line under the headline, e.g. the treatment. */
  detail: string;
  style: PosterStyle;
}

const FONT = "Inter, -apple-system, 'Segoe UI', sans-serif";

/** Template poster built from the salon's own photo and text. No AI image needed. */
export function Poster({ holiday, salon, offer, detail, style }: PosterProps) {
  const footer = `${salon.name} · ${salon.address} · ${t("campaigns.posterBook")}`;
  const image = style === "bold" ? "/demo/massage.webp" : "/demo/salon.webp";
  return (
    <svg viewBox="0 0 400 500" role="img" aria-label={`${holiday.name}: ${offer} ${detail}`} className="h-auto w-full rounded-2xl shadow-card" style={{ fontFamily: FONT }}>
      <defs>
        <clipPath id={`clip-${style}`}>
          <rect width="400" height="500" rx="18" />
        </clipPath>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.35" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#clip-${style})`}>
        {style === "calm" && (
          <>
            <rect width="400" height="500" fill="#F7F1E8" />
            <image href={image} x="0" y="0" width="400" height="270" preserveAspectRatio="xMidYMid slice" />
            <text x="32" y="318" fontSize="14" letterSpacing="2" fill="#2F5D50" fontWeight="600">{holiday.name.toUpperCase()}</text>
            <text x="32" y="364" fontSize="44" fontWeight="800" fill="#1F2A26">{offer}</text>
            <text x="32" y="394" fontSize="19" fontWeight="600" fill="#1F2A26">{detail}</text>
            <text x="32" y="420" fontSize="14" fill="#4A524D">{t("campaigns.posterUntil", { date: formatDayLong(holiday.date) })}</text>
            <line x1="32" x2="368" y1="440" y2="440" stroke="#D9CFC0" />
            <text x="32" y="468" fontSize="12" fill="#6E716A">{footer}</text>
          </>
        )}
        {style === "bold" && (
          <>
            <rect width="400" height="500" fill="#2F5D50" />
            <circle cx="330" cy="120" r="86" fill="#E3EEE8" opacity="0.14" />
            <image href={image} x="210" y="300" width="190" height="200" preserveAspectRatio="xMidYMid slice" />
            <text x="32" y="80" fontSize="15" letterSpacing="2" fill="#CFE3D9" fontWeight="600">{holiday.name.toUpperCase()}</text>
            <text x="32" y="168" fontSize="64" fontWeight="800" fill="#FFFFFF">{offer}</text>
            <text x="32" y="210" fontSize="22" fontWeight="600" fill="#FFFFFF">{detail}</text>
            <text x="32" y="250" fontSize="14" fill="#CFE3D9">{t("campaigns.posterUntil", { date: formatDayLong(holiday.date) })}</text>
            <text x="32" y="470" fontSize="12" fill="#CFE3D9">{salon.name}</text>
          </>
        )}
        {style === "photo" && (
          <>
            <image href={image} x="0" y="0" width="400" height="500" preserveAspectRatio="xMidYMid slice" />
            <rect width="400" height="500" fill="url(#shade)" />
            <text x="32" y="360" fontSize="14" letterSpacing="2" fill="#F7F1E8" fontWeight="600">{holiday.name.toUpperCase()}</text>
            <text x="32" y="402" fontSize="40" fontWeight="800" fill="#FFFFFF">{offer}</text>
            <text x="32" y="430" fontSize="18" fontWeight="600" fill="#FFFFFF">{detail}</text>
            <text x="32" y="452" fontSize="13" fill="#F7F1E8">{t("campaigns.posterUntil", { date: formatDayLong(holiday.date) })}</text>
            <text x="32" y="480" fontSize="11" fill="#E6DFD3">{footer}</text>
          </>
        )}
      </g>
    </svg>
  );
}
