import type { Palette } from "../../page/colour";
import type { ShowcaseTheme } from "../chrome";

export const BOLD_THEME_KEY = "salong-eko-vagad-theme";

/** The booking's colours in each scheme: the booking band's olive ground, the site's ink and its terracotta. */
export const BOLD_PALETTE: Record<ShowcaseTheme, Palette> = {
  dark: { background: "#22251c", text: "#f1e9dc", accent: "#e38a5d" },
  light: { background: "#e4ddcd", text: "#1f2219", accent: "#9c4426" },
};
