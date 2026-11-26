import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Schibsted_Grotesk } from "next/font/google";
import { TENANT_METADATA } from "@/concept/booking/tenant-metadata";

// Bricolage Grotesque (display) and Schibsted Grotesk (text), both SIL OFL. Chosen over Syne + Sora, which
// read like a tech brand, and Fraunces Black + IBM Plex Sans, a vintage face over a corporate one. Bricolage
// is loud and still friendly at 190 px; its optical sizes keep the price list's names sturdy.
const display = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--v-display" });
const text = Schibsted_Grotesk({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--v-text" });

export const metadata: Metadata = {
  // Repeated from the showcase layout: without it, this layout's own metadata lets the platform's web app manifest back in.
  ...TENANT_METADATA,
  title: { default: "Salong Eko – Ta av dig skorna", template: "%s – Salong Eko" },
  description: "Fotvård och massage på Dalagatan 34 i Vasastan, Stockholm. Boka tid online.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efe9dd" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1c15" },
  ],
};

export default function Layout({ children }: { children: ReactNode }) {
  return <div lang="sv" className={`${display.variable} ${text.variable}`}>{children}</div>;
}
