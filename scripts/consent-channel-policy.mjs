// Explicit opt-in policy for the split-mode staging customer channel.
// Shared by the socket server (refuse to start) and the request handlers (fail closed).
export const STAGING_CONSENT_MODE = "staging-inbox";

/** A bare HTTPS origin: no credentials, path, query or fragment. Never derived from request headers. */
// The raw string, before URL parsing (which resolves `/x/..`, `/./` and decodes nothing it would
// then report): `https://`, a host name or bracketed IPv6 address, an optional port and at most
// one trailing slash. Nothing else: no path, dot segment, percent escape, query, fragment,
// user info or backslash.
const BARE_HTTPS_ORIGIN = /^https:\/\/(([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*)|\[([0-9A-Fa-f:.]+)\])(?::(\d{1,5}))?\/?$/;
// Each part must be one a browser can open, so a link is never issued to an address no customer
// can reach: a port from 1 to 65535 written without leading zeros and not a Fetch bad port, DNS labels of at most 63
// bytes and a host name of at most 253, and a valid IPv6 literal.
// The Fetch standard's "bad ports" (https://fetch.spec.whatwg.org/#port-blocking): browsers refuse to
// fetch or navigate to them, so a consent link on one would be delivered and never open.
export const FETCH_BAD_PORTS = new Set([0, 1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103,
  104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540,
  548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666,
  6667, 6668, 6669, 6679, 6697, 10080]);
export function httpsOrigin(value) {
  const parts = typeof value === "string" ? BARE_HTTPS_ORIGIN.exec(value) : null;
  if (!parts) throw new Error("CONSENT_ORIGIN_INVALID");
  const [, , name, , port] = parts;
  if (port !== undefined && (!/^[1-9]\d*$/.test(port) || Number(port) > 65535 || FETCH_BAD_PORTS.has(Number(port))))
    throw new Error("CONSENT_ORIGIN_INVALID");
  if (name !== undefined && (name.length > 253 || name.split(".").some(label => label.length > 63))) throw new Error("CONSENT_ORIGIN_INVALID");
  // An IPv6 literal is validated by the URL parser below, whose rules (eight groups of at most four
  // hex digits, one `::`, a dotted IPv4 tail) match `net.isIPv6`; `node:net` itself cannot be
  // imported here, since this module also reaches browser bundles.
  const url = URL.parse(value);
  // A trailing dot (fully qualified name) is refused: routing compares host names without it.
  if (!url || url.protocol !== "https:" || !url.hostname || url.hostname.endsWith(".") || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/" || value.endsWith("#") || value.endsWith("?"))
    throw new Error("CONSENT_ORIGIN_INVALID");
  return url.origin;
}

/**
 * Returns the configured consent origin when the staging channel is enabled, or null when it is not.
 * Throws when it is requested without every required companion setting.
 */
export function stagingConsentPolicy(env) {
  if (env.BOOKING_CONSENT_DELIVERY !== STAGING_CONSENT_MODE) return null;
  if (env.BOOKING_SERVICE_ROLE !== "salon" || !/^[a-f0-9]{64}$/.test(env.GATEWAY_SERVICE_TOKEN ?? "") ||
      env.PUBLIC_READONLY === "1" || env.BOOKING_SMS_OTP_LAB === "1" ||
      env.BOOKING_CONSENT_LAB === "1" || env.BOOKING_CONSENT_INBOX_DIR !== undefined ||
      // Prisma's debug output (`DEBUG=prisma:*`, or any pattern that matches it) prints each query
      // with its arguments, including the approval link written to the inbox.
      Boolean(env.DEBUG) ||
      // The inbox key is derived from it; without a usable one every proposal would roll back.
      (env.SESSION_SECRET ?? "").length < 32)
    throw new Error("CONSENT_CHANNEL_CONFIG_INVALID");
  const consent = httpsOrigin(env.BOOKING_CONSENT_ORIGIN);
  // The agent-facing origin (gateway) and the customer page must never share a host name,
  // not only an origin: cookies are scoped by host, not port, so the owner's session cookie
  // on the salon would also be sent to a gateway on another port of the same host.
  if (new URL(httpsOrigin(env.BOOKING_PUBLIC_ORIGIN)).hostname === new URL(consent).hostname)
    throw new Error("CONSENT_CHANNEL_CONFIG_INVALID");
  return consent;
}

/**
 * True when a request's host (with its port, as the browser sent it) is exactly the configured
 * consent origin's. The consent page renders its form only then, so a link opened through another
 * alias or port of the same deployment never hands its secret to that origin.
 */
export function isConsentHost(env, rawHost) {
  try {
    const origin = stagingConsentPolicy(env);
    if (!origin || !rawHost) return false;
    return new URL(`https://${String(rawHost).trim().toLowerCase()}`).host === new URL(origin).host;
  } catch {
    return false;
  }
}

/** True when the staging channel is asked for, whether or not its configuration is valid. */
export function stagingConsentRequested(env) {
  return env.BOOKING_CONSENT_DELIVERY === STAGING_CONSENT_MODE;
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
/**
 * The origin the local consent lab issues its links for, as requireConsentLab and discoveryOrigin
 * read it (BOOKING_PUBLIC_ORIGIN, or 127.0.0.1 on PORT), or null when the lab is off, on Vercel or
 * that origin is not a bare loopback origin. Never derived from request headers; never throws.
 */
export function labConsentOrigin(env) {
  if (env.BOOKING_CONSENT_LAB !== "1" || env.BOOKING_RUNTIME === "vercel") return null;
  if (env.NODE_ENV === "production" && !env.BOOKING_PUBLIC_ORIGIN) return null;
  const url = URL.parse(env.BOOKING_PUBLIC_ORIGIN ?? `http://127.0.0.1:${env.PORT ?? "3000"}`);
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:") || !LOOPBACK_HOSTNAMES.has(url.hostname) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
  return url.origin;
}
/** True when a request's host (with its port) is exactly the lab's loopback origin's. */
function isLabConsentHost(env, rawHost) {
  const origin = labConsentOrigin(env);
  if (!origin || !rawHost) return false;
  const expected = new URL(origin);
  const actual = URL.parse(`${expected.protocol}//${String(rawHost).trim().toLowerCase()}`);
  return actual !== null && actual.host === expected.host;
}

/**
 * How the consent page may serve this request: the staging form on the exact consent origin, the
 * lab form only when the staging channel is not asked for at all, and otherwise nothing. An asked-for
 * but invalid staging configuration (for example settings loaded after the server's start check)
 * never falls back to the lab form, which would read and post the secret without these checks.
 */
export function consentPageMode(env, rawHost) {
  // The legacy lab form only where its decisions can be accepted at all (requireConsentLab): the
  // explicit lab switch, outside Vercel, and only on the loopback origin the lab issues its links
  // for. Elsewhere, for example a link of a disabled staging channel opened on a routable alias
  // after the switch to the lab, the form would read the fragment and post the secret there.
  if (!stagingConsentRequested(env)) return isLabConsentHost(env, rawHost) ? "lab" : "not-found";
  let valid = false;
  try { valid = stagingConsentPolicy(env) !== null; } catch { valid = false; }
  if (!valid) return "not-found";
  return isConsentHost(env, rawHost) ? "staging" : "not-found";
}

/** Host name served as the salon app when the staging channel is enabled; never throws. */
export function stagingConsentHost(env) {
  try {
    const origin = stagingConsentPolicy(env);
    return origin ? new URL(origin).hostname : null;
  } catch {
    return null;
  }
}

// Paths the consent host serves: the customer page and its decision endpoint, the owner's
// login and calendar (with the admin APIs it calls), the salon API the gateway calls, the
// language choice and static assets. Everything else on that host is not found.
const CONSENT_HOST_PATHS = /^\/(?:consent\/[^/]+(?:\/decision)?|admin(?:\/.*)?|api\/admin\/.+|api\/v1\/.+|api\/availability|api\/locale|_next\/.+|favicon\.ico|brand\/[\w.-]+|robots\.txt)$/;
export function consentHostPathAllowed(pathname) {
  return CONSENT_HOST_PATHS.test(pathname);
}

/**
 * Whether this host serves a path: on the consent host only its allowlisted paths (as the proxy
 * enforces), everywhere else every path. Pages use it to hide links the host would answer with 404.
 */
export function hostServesPath(env, rawHost, pathname) {
  const host = String(rawHost ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  const consentHost = stagingConsentHost(env);
  return consentHost === null || host !== consentHost || consentHostPathAllowed(pathname);
}
