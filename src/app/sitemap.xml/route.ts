import { productSiteOrigin } from "@/concept/site/origin";
import { siteRequestHost } from "@/concept/site/request-host";

export function GET(request: Request) {
  const origin = productSiteOrigin(siteRequestHost((name) => request.headers.get(name)));
  if (!origin) return new Response(null, { status: 404 });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/</loc></url>
  <url><loc>${origin}/sv</loc></url>
</urlset>
`;
  return new Response(sitemap, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
