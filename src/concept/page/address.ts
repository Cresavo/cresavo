import { checkSlug } from "./slug";

// Where a business's booking page lives. Level 1 is a path on the product host,
// level 2 a subdomain of the product domain (included), level 3 the business's
// own domain (a paid module, see `domain.ts`).

export const DEFAULT_PRODUCT_DOMAIN = "book.example";

/** The domain subdomains hang under. Set `NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN` when the product has a real one. */
export function productDomain(): string {
  return (process.env.NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN || DEFAULT_PRODUCT_DOMAIN).toLowerCase();
}

export const subdomainHost = (slug: string, domain = productDomain()) => `${slug}.${domain}`;

/** Businesses that already exist elsewhere in the demo, so their slugs are taken. */
export const OTHER_BUSINESS_SLUGS: readonly string[] = ["klippet", "nagelstudion", "fotterapin", "rorelsehuset"];

/** Whether this slug may be picked by the business that currently has `own`. */
export const checkOwnSlug = (input: string, own: string, localSalon = false) =>
  checkSlug(input, [...OTHER_BUSINESS_SLUGS, ...(localSalon ? ["salong-eko"] : [])].filter(slug => slug !== own));
