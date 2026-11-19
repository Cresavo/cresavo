import type { GetServerSidePropsContext } from "next";
import { getReleases, type ReleaseSummary } from "./github-releases";
import { getRepositorySummary } from "./github-stars";
import { productSiteOrigin } from "./origin";
import { siteRequestHost } from "./request-host";
import { isLocalHost, siteLinks } from "../page/resolve";

export interface SiteProps {
  /** Where the coming-soon page and the demo live for this visitor's host. */
  links: { apex: string; demo: string };
  /** The answer to a waiting-list form posted without JavaScript (`?waitlist=`). */
  waitlist: string | null;
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
      origin,
      analyticsEnabled: origin !== null && process.env.VERCEL_ENV === "production",
    } satisfies SiteProps,
  };
}

export interface ProjectActivity {
  releases: ReleaseSummary[];
  pushedAt: string | null;
  /** The server's clock, so "updated today" renders the same on the server and in the browser. */
  now: string;
}

export type ProductSiteProps = SiteProps & { stars: number | null; activity: ProjectActivity | null };

export async function getProductSiteProps(context: GetServerSidePropsContext) {
  const [{ props }, repository, releases] = await Promise.all([getSiteProps(context), getRepositorySummary(), getReleases()]);
  const activity = releases ? { releases, pushedAt: repository?.pushedAt ?? null, now: new Date().toISOString() } : null;
  return { props: { ...props, stars: repository?.stars ?? null, activity } satisfies ProductSiteProps };
}
