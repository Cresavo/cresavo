import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import { TENANT_METADATA } from "@/concept/booking/tenant-metadata";

// Newsreader (display) and Source Sans 3 (text), both SIL OFL. Chosen over Fraunces + Atkinson Hyperlegible
// and Cormorant Garamond + Karla: the calmest pair, with Newsreader's optical sizes crisp from the 76 px
// heading down to the price list, and Source Sans 3 easy to read at 15 px.
const display = Newsreader({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--k-display" });
const text = Source_Sans_3({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--k-text" });

export const metadata: Metadata = {
  // Repeated from the showcase layout: without it, this layout's own metadata lets the platform's web app manifest back in.
  ...TENANT_METADATA,
  title: { default: "Salong Eko – Fotvård och massage i Vasastan", template: "%s – Salong Eko" },
  description: "Medicinsk fotvård och massage på Dalagatan 34 i Vasastan, Stockholm. Boka tid online.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#141715" },
  ],
};

export default function Layout({ children }: { children: ReactNode }) {
  return <div lang="sv" className={`${display.variable} ${text.variable}`}>{children}</div>;
}
