import { headers } from "next/headers";
import { notFound } from "next/navigation";
import ConsentForm from "./form";
import StagingConsentForm from "./staging-form";
import { stagingCopy } from "./staging-copy";
import { consentPageMode, labConsentOrigin, stagingConsentPolicy, stagingConsentRequested } from "../../../../scripts/consent-channel-policy.mjs";
import { siteRequestHost } from "@/concept/site/request-host";
import { getLocale } from "@/lib/locale-server";
import { hostInstallMetadata } from "../../admin/served-path";

// Rendering reads no proposal and changes nothing; the client asks for the terms.
const staging = () => stagingConsentRequested(process.env);
const robots = { index: false, follow: false };
export async function generateMetadata() {
  const install = await hostInstallMetadata();
  if (!staging()) return { title: "Kundgodkännande – syntetiskt labb", robots, referrer: "no-referrer", ...install };
  return { title: stagingCopy[await getLocale()].title, robots, referrer: "no-referrer", ...install };
}
export default async function ConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestHeaders = await headers();
  const mode = consentPageMode(process.env, siteRequestHost(name => requestHeaders.get(name)));
  // Only on the configured consent origin, exactly, and only with a valid staging configuration:
  // anywhere else there is no form, so nothing there can read or post the link's secret.
  if (mode === "not-found") notFound();
  if (mode === "staging") {
    const locale = await getLocale();
    return <main className="p-4"><h1 className="text-h2">{stagingCopy[locale].title}</h1>
      <StagingConsentForm id={id} locale={locale} origin={stagingConsentPolicy(process.env)!} /></main>;
  }
  return <main><h1>Godkänn bokningsförslag</h1><ConsentForm id={id} origin={labConsentOrigin(process.env)!} /></main>;
}
