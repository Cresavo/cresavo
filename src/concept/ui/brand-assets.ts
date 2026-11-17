// Where the platform's brand assets live, for metadata and the web app
// manifest. The icons are the brand kit's TEMPORARY monogram placeholders
// (design/brand/libovo-v0.9/icons): replace them before any external launch.
// The colours are the kit's background tokens (libovo-theme.css), repeated here
// only because browser chrome and the manifest need plain values.

export const THEME_COLORS = { light: "#faf7f3", dark: "#18141e", action: "#50364b" } as const;

/** Browser tab and home-screen icons for platform pages (root layout metadata). Tenant pages use their own (`TENANT_METADATA`). */
export const PLATFORM_ICONS = {
  icon: [
    { url: "/favicon.ico", sizes: "any" },
    { url: "/brand/libovo-placeholder-32.png", sizes: "32x32", type: "image/png" },
  ],
  apple: [{ url: "/brand/libovo-placeholder-180.png", sizes: "180x180", type: "image/png" }],
};

export const APP_ICONS = [
  { src: "/brand/libovo-placeholder-192.png", sizes: "192x192", type: "image/png" },
  { src: "/brand/libovo-placeholder-512.png", sizes: "512x512", type: "image/png" },
] as const;
