import { Suspense } from "react";
import { GiftCardPage } from "@/concept/booking/gift-card-page";

export default function Page() {
  return (
    <Suspense>
      <GiftCardPage />
    </Suspense>
  );
}
