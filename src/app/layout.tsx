import { Inter } from "next/font/google";
import type { Viewport } from "next";
import "@/concept/ui/brand-theme.css";
import "./style.css";
import "./workspace-polish.css";
import { RestoreReturnScroll } from "./components/context-link";
import { LocaleProvider, LanguageSwitch } from "./components/locale-provider";
import { getLocale } from "@/lib/locale-server";
import { text } from "@/lib/locale";
import { BRAND } from "@/concept/brand";
import { PLATFORM_ICONS, THEME_COLORS } from "@/concept/ui/brand-assets";
import { THEME_SCRIPT } from "@/concept/ui/theme";

// Inter for the product UI (brand kit v0.9), self-hosted by next/font. Swedish
// needs latin-ext (å, ä, ö are in latin; latin-ext covers names such as Łukasz).
const inter = Inter({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-inter" });

export async function generateMetadata() {
  const locale = await getLocale();
  return {
    // Platform install metadata (with app/manifest.ts). Tenant routes replace it: see TENANT_METADATA.
    applicationName: BRAND.name,
    icons: PLATFORM_ICONS,
    title: text(locale, `Salong Eko — ${BRAND.name} demo`, "Salong Eko – boka tid"),
    description: text(locale, "Book a treatment at our fictional demo business.", "Boka en behandling hos vår demosalong."),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default async function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    // The theme script sets data-theme before React hydrates.
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <LocaleProvider locale={locale}>
          <RestoreReturnScroll />
          <aside className="demo-banner" aria-label={text(locale, "Demo notice", "Demoinformation")}>
            <span>
              {text(
                locale,
                "Demo — fictional data only",
                "Demo – endast påhittade uppgifter",
              )}
            </span>
            <LanguageSwitch />
          </aside>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
