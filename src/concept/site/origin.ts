import { productDomain } from "../page/address";
import { isLocalHost, normalizeHost } from "../page/resolve";

export function productSiteOrigin(rawHost: string | null | undefined): string | null {
  if (!process.env.NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN || isLocalHost(rawHost)) return null;
  const host = normalizeHost(rawHost);
  const domain = productDomain();
  return host === domain || host === `www.${domain}` ? `https://${domain}` : null;
}
