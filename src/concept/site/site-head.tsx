import { sitePath, type SitePage } from "./language";
import Head from "next/head";
import { BRAND } from "../brand";
import { PLATFORM_ICONS, THEME_COLORS } from "../ui/brand-assets";
import { useSiteCopy } from "./copy";

/** Document metadata for a site page: title, description, social preview text, platform icons and browser chrome that follows the visitor's scheme. */
export function SiteHead({ title, description, productOrigin, page = "home" }: { title: string; description: string; productOrigin?: string | null; page?: SitePage }) {
  const { site, locale } = useSiteCopy();
  const url = (lang: "en" | "sv") => (productOrigin ?? "") + sitePath(lang, page);
  const image = `${productOrigin ?? ""}/site/tour-16x9-poster.jpg`;
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <meta name="application-name" content={BRAND.name} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={BRAND.name} />
      <meta property="og:locale" content={locale === "sv" ? "sv_SE" : "en_GB"} />
      <link rel="canonical" href={url(locale)} />
      <link rel="alternate" hrefLang="en" href={url("en")} />
      <link rel="alternate" hrefLang="sv" href={url("sv")} />
      <link rel="alternate" hrefLang="x-default" href={url("en")} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta name="twitter:card" content={productOrigin ? "summary_large_image" : "summary"} />
      {productOrigin && <>
        <meta property="og:url" content={url(locale)} />
        <meta property="og:image" content={image} />
        <meta property="og:image:width" content="960" />
        <meta property="og:image:height" content="540" />
        <meta property="og:image:alt" content={site["soon.share.alt"]} />
      </>}
      <meta name="theme-color" media="(prefers-color-scheme: light)" content={THEME_COLORS.light} />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content={THEME_COLORS.dark} />
      {PLATFORM_ICONS.icon.map((icon) => <link key={icon.url} rel="icon" href={icon.url} sizes={icon.sizes} />)}
      {PLATFORM_ICONS.apple.map((icon) => <link key={icon.url} rel="apple-touch-icon" href={icon.url} sizes={icon.sizes} />)}
    </Head>
  );
}
