// Explicit opt-in policy for the split-mode staging customer channel.
// Shared by the socket server (refuse to start) and the request handlers (fail closed).
export const STAGING_CONSENT_MODE = "staging-inbox";

/** A bare HTTPS origin: no credentials, path, query or fragment. Never derived from request headers. */
export function httpsOrigin(value) {
  const url = URL.parse(value ?? "");
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
