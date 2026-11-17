import { Suspense } from "react";
import { MyBookings } from "@/concept/booking/my-bookings";

export default function Page() {
  return (
    <Suspense>
      <MyBookings />
    </Suspense>
  );
}
