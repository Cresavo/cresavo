import { Suspense } from "react";
import { demoOnly } from "@/lib/public-page";
import { GiftCardPage } from "@/concept/booking/gift-card-page";

export default async function Page() {
  await demoOnly();
  return (
    <Suspense>
      <GiftCardPage />
    </Suspense>
  );
}
