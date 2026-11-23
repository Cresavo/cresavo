import type { NextConfig } from "next";
const production = process.env.NODE_ENV === "production";
// The Content-Security-Policy is set per request in src/proxy.ts (src/lib/csp.ts) so scripts carry a nonce.
// Features the product never uses. Clipboard stays available for copy buttons.
const permissionsPolicy = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()";
const config: NextConfig = {
  outputFileTracingIncludes: {
    "/api/v1/openapi": ["./docs/agent-api-v1.openapi.yaml"],
    "/api/concept/poster": ["./src/concept/campaigns/poster-engine/fonts/**"],
  },
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  // Only the demo photos go through the image optimiser. Library pictures and logos are served by the app
  // after its own checks; an optimised copy would outlive a removed logo (src/lib/media/respond.ts).
  images: { localPatterns: [{ pathname: "/demo/**", search: "" }] },
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: permissionsPolicy },
          ...(production
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
      {
        // OAuth and consent pages open from assistant windows that may watch the popup.
        source: "/:path((?!oauth/|authorize|consent/).*)",
        headers: [{ key: "Cross-Origin-Opener-Policy", value: "same-origin" }],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};
export default config;
