// A guard against other websites posting to the studio's own endpoints from a
// visitor's browser. Not authentication: the demo studio has no login yet.
export function fromSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}
