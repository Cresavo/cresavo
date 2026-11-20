import { headers } from "next/headers";
import { siteRequestHost } from "@/concept/site/request-host";
import { hostServesPath } from "../../../scripts/consent-channel-policy.mjs";

/** Whether this request's host serves `pathname` (the split-mode consent host serves only a few). */
export async function servesPath(pathname: string) {
  const h = await headers();
  return hostServesPath(process.env, siteRequestHost((name) => h.get(name)), pathname);
}
