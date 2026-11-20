import { originMatchesSite } from "@/lib/same-origin";

// A guard against other websites calling the studio's own endpoints from a
// visitor's browser. Not authentication: the demo studio has no login yet.
// Sec-Fetch-Site decides when present, so same-origin GETs without Origin pass.
export function fromSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const read = (name: string) => request.headers.get(name);
  return originMatchesSite(read("origin"), read, new URL(request.url).host);
}

