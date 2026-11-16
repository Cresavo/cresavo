import { Suspense } from "react";
import { SalonPage } from "@/concept/booking/salon-page";

export default function Page() {
  return (
    <Suspense>
      <SalonPage />
    </Suspense>
  );
}
