import type { Metadata } from "next";

// What a public booking route tells the browser about itself. It replaces the
// platform's install metadata (name, icons, web app manifest) so a business's
// page never presents itself as the platform. The icon is a neutral calendar;
// BookShell swaps in the business's own logo when it has one.

export const TENANT_ICON = "/tenant/icon.svg";

export const TENANT_METADATA = {
  applicationName: null,
  manifest: null,
  icons: { icon: [{ url: TENANT_ICON, type: "image/svg+xml" }], apple: [{ url: "/tenant/apple-icon.png", sizes: "180x180", type: "image/png" }] },
} satisfies Metadata;
