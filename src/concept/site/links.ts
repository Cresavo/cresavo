import type { GetServerSidePropsContext } from "next";
import { getStarCount } from "./github-stars";
import { siteRequestHost } from "./request-host";
import { isLocalHost, resolveHost, siteLinks } from "../page/resolve";

export interface SiteProps {
  /** Where the coming-soon page and the demo live for this visitor's host. */
  links: { apex: string; demo: string };
  /** The answer to a waiting-list form posted without JavaScript (`?waitlist=`). */
  waitlist: string | null;
}

/** The two sites share one deployment, so each page learns from the request's host how to reach the other. */
export async function getSiteProps({ req, query }: GetServerSidePropsContext) {
  const host = siteRequestHost((name) => {
    const value = req.headers[name];
    return typeof value === "string" ? value : undefined;
  });
  // Behind a server that hides the public host (localhost), fall back to the product domain;
  // preview deployments keep same-deployment links so a preview links to itself.
  const linksHost = resolveHost(host).kind === "site" || !isLocalHost(host)
    ? host
    : process.env.NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN;
  return {
    props: { links: siteLinks(linksHost), waitlist: typeof query.waitlist === "string" ? query.waitlist : null },
  };
}

export type ProductSiteProps = SiteProps & { stars: number | null };

export async function getProductSiteProps(context: GetServerSidePropsContext) {
  const { props } = await getSiteProps(context);
  return { props: { ...props, stars: await getStarCount() } };
}
