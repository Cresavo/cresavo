import ConsentForm from "./form";
import StagingConsentForm from "./staging-form";
import { stagingCopy } from "./staging-copy";
import { stagingConsentHost } from "../../../../scripts/consent-channel-policy.mjs";
import { getLocale } from "@/lib/locale-server";

// Rendering reads no proposal and changes nothing; the client asks for the terms.
const staging = () => stagingConsentHost(process.env) !== null;
const robots = { index: false, follow: false };
export async function generateMetadata() {
  if (!staging()) return { title: "Kundgodkännande – syntetiskt labb", robots, referrer: "no-referrer" };
  return { title: stagingCopy[await getLocale()].title, robots, referrer: "no-referrer" };
}
export default async function ConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (staging()) {
    const locale = await getLocale();
    return <main className="p-4"><h1 className="text-h2">{stagingCopy[locale].title}</h1><StagingConsentForm id={id} locale={locale} /></main>;
  }
  return <main><h1>Godkänn bokningsförslag</h1><ConsentForm id={id} /></main>;
}
