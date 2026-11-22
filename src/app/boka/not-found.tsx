import { headers } from "next/headers";
import { UnknownAddress } from "@/concept/booking/unknown-address";
import { LinkTokenScrub } from "@/concept/booking/link-token";
import "../studio/studio.css";

// The 404 of every booking address under /boka: an unknown salon (a layout's own `notFound()` is caught by the
// segment above it, so the boundary lives here, not in `[slug]`) or a page a live salon does not have. A booking
// link carries its token in the address fragment, so this boundary removes it from the address like the booking
// page does.
export default async function NotFound() {
  const host = (await headers()).get("x-concept-address");
  return (
    <div className="studio-root booking-boundary">
      <LinkTokenScrub />
      <UnknownAddress host={host?.slice(0, 100)} />
    </div>
  );
}
