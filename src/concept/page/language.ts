export function conceptRoute(pathname: string) {
  if (/^\/studio(?:\/|$)/.test(pathname)) return "studio";
  // The demo register's payment page is a customer's page too: no platform banner, the neutral tenant look.
  if (/^\/(?:boka|betala)(?:\/|$)/.test(pathname)) return "booking";
  // The showcase salon sites are a business's own website: the same tenant treatment, never the platform banner.
  if (/^\/showcase(?:\/|$)/.test(pathname)) return "booking";
  if (/^\/(?:unknown-address|coming-soon)(?:\/|$)/.test(pathname)) return "english";
  return null;
}
