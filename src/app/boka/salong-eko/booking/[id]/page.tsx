import { Confirmation } from "@/concept/booking/confirmation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Confirmation id={id} />;
}
