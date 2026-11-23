import type { AppProps } from "next/app";
import { Inter, Instrument_Serif } from "next/font/google";
import { inject, type BeforeSend } from "@vercel/analytics";
import { useEffect } from "react";
import { SiteLocale } from "@/concept/site/copy";
import { siteLocale } from "@/concept/site/language";
import type { SiteProps } from "@/concept/site/links";
import "@/concept/ui/brand-theme.css";
import "@/concept/site/site-base.css";

// The pages router (the two public sites) gets the same brand tokens and UI font as the app router.
const inter = Inter({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-inter" });
// The product site's display face: headings on the homepage only. Inter stays the body, UI and product-panel face.
const display = Instrument_Serif({ subsets: ["latin", "latin-ext"], weight: "400", style: "normal", display: "swap", variable: "--font-display" });

const removeUrlParameters: BeforeSend = (event) => {
  const url = new URL(event.url);
  return { ...event, url: `${url.origin}${url.pathname}` };
};

export default function App({ Component, pageProps, router }: AppProps<Partial<SiteProps>>) {
  const locale = siteLocale(router.pathname);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const analyticsOrigin = pageProps.analyticsEnabled ? pageProps.origin : null;
  useEffect(() => {
    // The server can see loopback after a rewrite. Measure only the actual public origin.
    if (analyticsOrigin !== window.location.origin) return;
    inject({
      basePath: process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH,
      beforeSend: removeUrlParameters,
      framework: "next",
    }, process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG);
  }, [analyticsOrigin]);

  return (
    <div className={`${inter.variable} ${display.variable} site`}>
      <SiteLocale.Provider value={locale}>
        <Component {...pageProps} />
      </SiteLocale.Provider>
    </div>
  );
}
