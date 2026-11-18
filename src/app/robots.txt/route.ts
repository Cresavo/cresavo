import { productSiteOrigin } from "@/concept/site/origin";
import { siteRequestHost } from "@/concept/site/request-host";

export function GET(request: Request) {
  const origin = productSiteOrigin(siteRequestHost((name) => request.headers.get(name)));
  const rules = "User-agent: *\nAllow: /\n";
  return new Response(origin ? `${rules}\nSitemap: ${origin}/sitemap.xml\n` : rules, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
