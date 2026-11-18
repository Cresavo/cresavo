/** Vercel supplies the public host. The socket server supplies it for allowlisted proxies. */
export function siteRequestHost(readHeader: (name: string) => string | null | undefined) {
  const forwarded = process.env.BOOKING_RUNTIME === "vercel" && process.env.VERCEL === "1"
    ? readHeader("x-forwarded-host")
    : process.env.TRUST_PROXY_IP === "1" && process.env.BOOKING_ADDRESS_SECRET
      ? readHeader("x-booking-forwarded-host")
      : undefined;

  const host = forwarded?.trim();
  // A trusted proxy supplies a single hostname, with an optional port.
  return host && /^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::\d+)?$/i.test(host)
    ? host
    : readHeader("host");
}
