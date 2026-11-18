// Where the platform's brand assets live, for metadata and the web app
// manifest. The icons are the brand kit's TEMPORARY monogram placeholders
// (design/brand/libovo-v0.9/icons): replace them before any external launch.
// Browser chrome and the manifest need plain colour values: they are read from
// the kit's colors.json, the same source brand-theme.css is checked against
// (tests/concept-tokens.test.ts), so there is no second copy to keep in step.

import kit from "../../../design/brand/cresavo-v0.1/tokens/colors.json" with { type: "json" };

export const THEME_COLORS = {
  light: kit.light.background.toLowerCase(),
  dark: kit.dark.background.toLowerCase(),
  action: kit.brand.plum.toLowerCase(),
};

/** Browser tab and home-screen icons for platform pages (root layout metadata). Tenant pages use their own (`TENANT_METADATA`). */
export const PLATFORM_ICONS = {
  icon: [
    { url: "/favicon.ico", sizes: "any" },
    { url: "/brand/icon-temporary-32.png", sizes: "32x32", type: "image/png" },
  ],
  apple: [{ url: "/brand/icon-temporary-180.png", sizes: "180x180", type: "image/png" }],
};

export const APP_ICONS = [
  { src: "/brand/icon-temporary-192.png", sizes: "192x192", type: "image/png" },
  { src: "/brand/icon-temporary-512.png", sizes: "512x512", type: "image/png" },
] as const;
