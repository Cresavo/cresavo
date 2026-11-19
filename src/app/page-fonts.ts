import { Bodoni_Moda, Fraunces, Outfit, Playfair_Display } from "next/font/google";

// The heading fonts of the ready-made booking page designs (concept/page/theme.ts),
// self-hosted by next/font like Inter. The booking and studio layouts put the
// variables on their root. Nothing is preloaded: a browser only fetches the font
// a page's theme actually uses.

const fraunces = Fraunces({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-fraunces" });
const playfair = Playfair_Display({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-playfair" });
const bodoni = Bodoni_Moda({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-bodoni" });
const outfit = Outfit({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-outfit" });

/** Class names that define the font variables on an element. */
export const PAGE_FONTS = [fraunces, playfair, bodoni, outfit].map((font) => font.variable).join(" ");
