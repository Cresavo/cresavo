import type { Palette } from "../../page/colour";
import type { ShowcaseTheme } from "../chrome";

export const CLASSIC_THEME_KEY = "salong-eko-klassisk-theme";

/** The booking's colours in each scheme: the booking band's ground, the site's ink and its deep green. */
export const CLASSIC_PALETTE: Record<ShowcaseTheme, Palette> = {
  light: { background: "#efede8", text: "#1f2421", accent: "#2f4a3f" },
  dark: { background: "#1c201d", text: "#ebe8e1", accent: "#a8c4b4" },
};
