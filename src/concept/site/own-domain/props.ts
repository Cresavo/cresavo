import type { GetServerSidePropsContext } from "next";
import { getSiteProps, type SiteProps } from "../links";
import { siteRequestHost } from "../request-host";
import { isLocalHost } from "../../page/resolve";

export type OwnDomainProps = SiteProps & {
  /** The origin that serves the demo salon's booking page and widget, for code a visitor can copy and use. */
  bookingOrigin: string;
};

/** Where the demo's booking lives: the demo host on the real sites, this deployment everywhere else. */
export function bookingOriginFor(demo: string, host: string | undefined): string {
  if (/^https?:\/\//.test(demo)) return new URL(demo).origin;
  const name = host || "localhost";
  return `${isLocalHost(name) ? "http" : "https"}://${name}`;
}

export async function getOwnDomainProps(context: GetServerSidePropsContext) {
  const { props } = await getSiteProps(context);
  const host = siteRequestHost((name) => {
    const value = context.req.headers[name];
    return typeof value === "string" ? value : undefined;
  });
  return { props: { ...props, bookingOrigin: bookingOriginFor(props.links.demo, host ?? undefined) } satisfies OwnDomainProps };
}
