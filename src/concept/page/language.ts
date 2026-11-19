export function conceptRoute(pathname: string) {
  if (/^\/studio(?:\/|$)/.test(pathname)) return "studio";
  if (/^\/boka(?:\/|$)/.test(pathname)) return "booking";
  if (/^\/(?:unknown-address|coming-soon)(?:\/|$)/.test(pathname)) return "english";
  return null;
}
