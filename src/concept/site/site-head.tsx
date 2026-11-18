import Head from "next/head";
import { BRAND } from "../brand";
import { PLATFORM_ICONS, THEME_COLORS } from "../ui/brand-assets";

/** Document metadata for a site page: title, description, social preview text, platform icons and browser chrome that follows the visitor's scheme. */
export function SiteHead({ title, description }: { title: string; description: string }) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <meta name="application-name" content={BRAND.name} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={BRAND.name} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta name="twitter:card" content="summary" />
      <meta name="theme-color" media="(prefers-color-scheme: light)" content={THEME_COLORS.light} />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content={THEME_COLORS.dark} />
      {PLATFORM_ICONS.icon.map((icon) => <link key={icon.url} rel="icon" href={icon.url} sizes={icon.sizes} />)}
      {PLATFORM_ICONS.apple.map((icon) => <link key={icon.url} rel="apple-touch-icon" href={icon.url} sizes={icon.sizes} />)}
    </Head>
  );
}
