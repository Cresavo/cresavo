import type { NextConfig } from "next";
const production = process.env.NODE_ENV === "production";
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${production ? "" : " ws://localhost:* ws://127.0.0.1:*"}`,
].join("; ");
const config: NextConfig = {
  outputFileTracingIncludes: {
    "/api/v1/openapi": ["./docs/agent-api-v1.openapi.yaml"],
  },
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...(production
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
      {
        // The consent handler supplies a narrower CSP with the reviewed OAuth
        // callback origin. Chromium checks form-action on the 303 as well.
        source: "/:path((?!oauth/authorize/?$).*)",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
      {
        source: "/boka/:slug",
        // The page editor shows the booking page in a frame of its own origin.
        headers: [{ key: "Content-Security-Policy", value: csp.replace("frame-ancestors 'none'", "frame-ancestors 'self'") }],
      },
      {
        source: "/boka/:slug/widget",
        // Only the dedicated public widget may be embedded. The rest keeps its policy.
        headers: [{ key: "Content-Security-Policy", value: csp.replace("frame-ancestors 'none'", "frame-ancestors *") }],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};
export default config;
