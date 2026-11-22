import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { publicBookingLive } from "./public-booking";

/** The request's headers, and whether it is served from the server's salons (see `publicBookingLive`). */
export async function publicPageRequest() {
  const requestHeaders = await headers();
  return { requestHeaders, live: publicBookingLive((name) => requestHeaders.get(name)) };
}

/** For customer pages that only exist in the demo (my bookings, gift cards, a booking's confirmation): not found for a live salon. */
export async function demoOnly() {
  if ((await publicPageRequest()).live) notFound();
}
