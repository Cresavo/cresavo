// Every line the staging runner prints goes through here. Known secrets are removed
// exactly; anything that looks like a link fragment, key, token, cookie or database
// URL is removed by pattern as a second layer.
const known = new Set<string>();
// Secrets too short to search for on their own (the local development password "booking" also
// names the project): matched only where a credential stands, so none is silently left out.
const short = new Map<string, RegExp>();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Registers a secret for exact redaction and the output scan; a short one in credential contexts. */
export function registerSecret(value: string | undefined | null) {
  if (!value) return;
  if (value.length >= 8) { known.add(value); return; }
  // `user:<value>@` in a URL, `password=<value>` / `password: <value>` / `PGPASSWORD=<value>`.
  const v = escape(value);
  short.set(value, new RegExp(`(?::${v}@|\\b(?:pg)?pass(?:word)?\\b["']?\\s*[:=]\\s*["']?${v}(?![A-Za-z0-9_-]))`, "gi"));
}
/** How many registered secrets are checked only in credential contexts. */
export const shortSecretCount = () => short.size;
const patterns: RegExp[] = [
  /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g,
  /postgres(?:ql)?:\/\/\S+/gi,
  /\bblk_[A-Za-z0-9_-]+/g,
  /\b(?:booking_admin|__Host-[\w-]+|__Secure-[\w-]+)=[^;\s]+/g,
  /\/consent\/[^\s"'#]*#[^\s"']*/g,
  /#[A-Za-z0-9_-]{20,}/g,
  /\b[a-f0-9]{40,}\b/gi,
  // The whole header value to the end of the line or quoted string: scheme, credential and any further cookies.
  /\b(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-booking-gateway-token)\b["']?\s*[:=]\s*["']?[^\r\n"']+/gi,
];
export function sanitize(text: string) {
  let out = text;
  for (const value of known) out = out.split(value).join("[redacted]");
  for (const pattern of short.values()) out = out.replace(pattern, "[redacted]");
  for (const pattern of patterns) out = out.replace(pattern, "[redacted]");
  // Long opaque runs are redacted; static UPPER_CASE check codes are not secrets.
  out = out.replace(/[A-Za-z0-9_-]{40,}/g, run => /^[A-Z_]+$/.test(run) ? run : "[redacted]");
  return out.replace(/[\r\n]+/g, " ").slice(0, 400);
}
/** True when the text contains any registered secret. Used to scan agent and process output. */
export function containsSecret(text: string) {
  for (const value of known) if (text.includes(value)) return true;
  for (const pattern of short.values()) { pattern.lastIndex = 0; if (pattern.test(text)) return true; }
  return false;
}
export const say = (line: string) => console.log(sanitize(line));
