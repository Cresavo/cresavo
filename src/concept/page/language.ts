export function conceptRoute(pathname: string) {
  if (/^\/studio(?:\/|$)/.test(pathname)) return "studio";
  // The demo register's payment page is a customer's page too: no platform banner, the neutral tenant look.
  if (/^\/(?:boka|betala)(?:\/|$)/.test(pathname)) return "booking";
  if (/^\/(?:unknown-address|coming-soon)(?:\/|$)/.test(pathname)) return "english";
  return null;
}
