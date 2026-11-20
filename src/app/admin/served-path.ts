import { headers } from "next/headers";
import { siteRequestHost } from "@/concept/site/request-host";
import { hostServesPath } from "../../../scripts/consent-channel-policy.mjs";

/** Whether this request's host serves `pathname` (the split-mode consent host serves only a few). */
export async function servesPath(pathname: string) {
  const h = await headers();
  return hostServesPath(process.env, siteRequestHost((name) => h.get(name)), pathname);
}

/**
 * Metadata for a segment the consent host serves. app/manifest.ts advertises the studio install
 * manifest on every page, but the consent host does not serve it (its allowlist stays as it is),
 * so pages there link no manifest. A segment's `manifest: null` replaces the root's file manifest.
 */
export async function hostInstallMetadata(): Promise<{ manifest?: null }> {
  return (await servesPath("/manifest.webmanifest")) ? {} : { manifest: null };
}
