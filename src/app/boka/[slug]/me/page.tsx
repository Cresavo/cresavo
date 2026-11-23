import { Suspense } from "react";
import { demoOnly } from "@/lib/public-page";
import { MyBookings } from "@/concept/booking/my-bookings";

export default async function Page() {
  await demoOnly();
  return (
    <Suspense>
      <MyBookings />
    </Suspense>
  );
}
