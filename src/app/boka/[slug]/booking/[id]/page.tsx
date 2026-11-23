import { publicPageRequest } from "@/lib/public-page";
import { Confirmation } from "@/concept/booking/confirmation";
import { ServerBookingView } from "@/concept/booking/server-booking-view";

export default async function Page({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  // A live salon shows the booking only to the holder of the link in its e-mail; the demo keeps its own confirmation.
  if ((await publicPageRequest()).live) return <ServerBookingView slug={slug.toLowerCase()} id={id} />;
  return <Confirmation id={id} />;
}
