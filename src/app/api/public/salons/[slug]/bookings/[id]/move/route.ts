import type { NextRequest } from "next/server";
import { manageBooking } from "@/lib/public-booking-manage";
import { moveBookingSchema } from "@/lib/public-booking-request";
import type { StaffId } from "@/concept/data/types";

/** Moves the booking of the holder of its link to another free time, free of charge, before the free-cancellation deadline. */
export function POST(request: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  return manageBooking(request, params, moveBookingSchema, (id, { staffId, date, start }, common) => ({
    type: "online/move", id, ...common, staffId: staffId as StaffId, date, start,
  }));
}
