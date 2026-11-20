import { Barlow_Condensed, Bodoni_Moda, Familjen_Grotesk, Outfit } from "next/font/google";

// The heading fonts of the ready-made booking page designs (concept/page/theme.ts),
// self-hosted by next/font like Inter. The booking and studio layouts put the
// variables on their root. Nothing is preloaded: a browser only fetches the font
// a page's theme actually uses.

const familjen = Familjen_Grotesk({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-familjen" });
const bodoni = Bodoni_Moda({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-bodoni" });
const barlow = Barlow_Condensed({ subsets: ["latin", "latin-ext"], weight: ["500", "600"], display: "swap", preload: false, variable: "--font-barlow" });
const outfit = Outfit({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-outfit" });

/** Class names that define the font variables on an element. */
export const PAGE_FONTS = [familjen, bodoni, barlow, outfit].map((font) => font.variable).join(" ");
