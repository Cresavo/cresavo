import ConsentForm from "./form";
export const metadata = { title: "Kundgodkännande – syntetiskt labb", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function ConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main><h1>Godkänn bokningsförslag</h1><ConsentForm id={id} /></main>;
}
