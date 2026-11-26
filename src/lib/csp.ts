/**
 * Content Security Policy with a per-request script nonce. The proxy sets it
 * on the request, so Next.js stamps its own scripts with the nonce, and on the
 * response. Styles keep 'unsafe-inline': React style attributes and the
 * booking page's theme CSS need it, and a nonce does not cover attributes.
 */

/** The OAuth consent handler and the photo library's picture responses (src/lib/media/respond.ts) send their own narrower policy. */
export function cspExempt(pathname: string): boolean {
  return /^\/oauth\/authorize\/?$/.test(pathname) || /^\/api\/(?:owner\/media\/[^/]+|public\/media\/[^/]+\/[^/]+)\/?$/.test(pathname);
}

// The page editor frames the booking page on its own origin; only the widget may be embedded elsewhere.
function frameAncestors(pathname: string): string {
  if (/^\/boka\/[^/]+\/widget\/?$/.test(pathname)) return "*";
  if (/^\/boka\/[^/]+\/?$/.test(pathname)) return "'self'";
  return "'none'";
}

/** The X-Frame-Options value for older browsers, matching `frame-ancestors`: null where any site may frame the page (the widget). */
export function frameOptions(pathname: string): "DENY" | "SAMEORIGIN" | null {
  const ancestors = frameAncestors(pathname);
  return ancestors === "*" ? null : ancestors === "'self'" ? "SAMEORIGIN" : "DENY";
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** `connect` lists further origins scripts may call; the phone receptionist's test call adds the Realtime API for the studio. */
export function contentSecurityPolicy(nonce: string, pathname: string, production = process.env.NODE_ENV === "production", connect: readonly string[] = []): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `frame-ancestors ${frameAncestors(pathname)}`,
    "form-action 'self'",
    // 'strict-dynamic' lets the nonced Next.js runtime load its chunks and the analytics script.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    // Journal recordings in the concept demo play from object URLs made in this tab.
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self'${connect.map((origin) => ` ${origin}`).join("")}${production ? "" : " ws://localhost:* ws://127.0.0.1:*"}`,
  ].join("; ");
}
