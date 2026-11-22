import { demoOnly } from "@/lib/public-page";
import { Confirmation } from "@/concept/booking/confirmation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await demoOnly();
  const { id } = await params;
  return <Confirmation id={id} />;
}
