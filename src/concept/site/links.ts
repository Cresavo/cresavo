import type { GetServerSideProps } from "next";
import { siteLinks } from "../page/resolve";

export interface SiteProps {
  /** Where the coming-soon page and the demo live for this visitor's host. */
  links: { apex: string; demo: string };
  /** The answer to a waiting-list form posted without JavaScript (`?waitlist=`). */
  waitlist: string | null;
}

/** The two sites share one deployment, so each page learns from the request's host how to reach the other. */
export const getSiteProps: GetServerSideProps<SiteProps> = async ({ req, query }) => ({
  props: { links: siteLinks(req.headers.host), waitlist: typeof query.waitlist === "string" ? query.waitlist : null },
});
