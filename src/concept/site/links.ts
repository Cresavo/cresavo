import type { GetServerSidePropsContext } from "next";
import { getStarCount } from "./github-stars";
import { productSiteOrigin } from "./origin";
import { siteRequestHost } from "./request-host";
import { waitlistIsOpen } from "./waitlist";
import { isLocalHost, siteLinks } from "../page/resolve";

export interface SiteProps {
  /** Where the coming-soon page and the demo live for this visitor's host. */
  links: { apex: string; demo: string };
  /** The answer to a waiting-list form posted without JavaScript (`?waitlist=`). */
  waitlist: string | null;
  /** Whether the waiting list stores sign-ups; while it doesn't, the page shows no form. */
  waitlistOpen: boolean;
  origin: string | null;
  analyticsEnabled: boolean;
}

/** The two sites share one deployment, so each page learns from the request's host how to reach the other. */
export async function getSiteProps({ req, query }: GetServerSidePropsContext) {
  const host = siteRequestHost((name) => {
    const value = req.headers[name];
    return typeof value === "string" ? value : undefined;
  });
  // A production proxy can hide the public host behind loopback. Development and previews keep local links.
  const linksHost = isLocalHost(host) && process.env.NODE_ENV !== "development"
    ? process.env.NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN
    : host;
  const origin = productSiteOrigin(linksHost);
  return {
    props: {
      links: siteLinks(linksHost),
      waitlist: typeof query.waitlist === "string" ? query.waitlist : null,
      waitlistOpen: waitlistIsOpen(),
      origin,
      analyticsEnabled: origin !== null && process.env.VERCEL_ENV === "production",
    } satisfies SiteProps,
  };
}

export type ProductSiteProps = SiteProps & { stars: number | null };

export async function getProductSiteProps(context: GetServerSidePropsContext) {
  const { props } = await getSiteProps(context);
  return { props: { ...props, stars: await getStarCount() } };
}
