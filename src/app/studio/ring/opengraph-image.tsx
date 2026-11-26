/* ImageResponse does not load brand-theme.css, so the light tokens are written out. */
/* eslint-disable design-system/no-hex */
import { ImageResponse } from "next/og";
import { BRAND } from "@/concept/brand";
import { translate } from "@/concept/i18n";
import { getLocale } from "@/lib/locale-server";

export const alt = "Ring Maja";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// A calm, light share card: Maja's initial, the salon, and Cresavo's ink.
// Colours are the light brand tokens, written out because this image does not
// load the site stylesheet.
export default async function Image() {
  const language = await getLocale();
  const salon = "Salong Eko";
  const monogram = translate(language, "webCall.monogram");
  const title = translate(language, "webCall.ogHeading");
  const role = translate(language, "webCall.role", { salon });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#faf7f3",
          color: "#2c242e",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 128,
            height: 128,
            borderRadius: 128,
            background: "#eeebed",
            color: "#50364b",
            fontSize: 64,
            fontWeight: 600,
          }}
        >
          {monogram}
        </div>
        <div style={{ marginTop: 40, fontSize: 64, fontWeight: 600, letterSpacing: "-0.03em" }}>
          {title}
        </div>
        <div style={{ marginTop: 12, fontSize: 32, color: "#6f666f" }}>
          {role}
        </div>
        <div style={{ marginTop: 48, fontSize: 24, color: "#50364b" }}>
          {BRAND.name}
        </div>
      </div>
    ),
    { ...size },
  );
}
