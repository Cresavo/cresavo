// Explicit opt-in policy for the split-mode staging customer channel.
// Shared by the socket server (refuse to start) and the request handlers (fail closed).
export const STAGING_CONSENT_MODE = "staging-inbox";

/** A bare HTTPS origin: no credentials, path, query or fragment. Never derived from request headers. */
export function httpsOrigin(value) {
  const url = URL.parse(value ?? "");
  if (!url || url.protocol !== "https:" || !url.hostname || url.username || url.password ||
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
      env.BOOKING_CONSENT_LAB === "1" || env.BOOKING_CONSENT_INBOX_DIR !== undefined)
    throw new Error("CONSENT_CHANNEL_CONFIG_INVALID");
  const consent = httpsOrigin(env.BOOKING_CONSENT_ORIGIN);
  // The agent-facing origin (gateway) and the customer page must never share an origin.
  if (httpsOrigin(env.BOOKING_PUBLIC_ORIGIN) === consent) throw new Error("CONSENT_CHANNEL_CONFIG_INVALID");
  return consent;
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
