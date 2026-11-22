import type { NextRequest } from "next/server";
import { manageBooking } from "@/lib/public-booking-manage";
import { cancelBookingSchema } from "@/lib/public-booking-request";

/** Cancels the booking of the holder of its link, free of charge, while the salon's free-cancellation deadline has not passed. */
export function POST(request: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  return manageBooking(request, params, cancelBookingSchema, (id, _body, common) => ({ type: "online/cancel", id, ...common }));
}
