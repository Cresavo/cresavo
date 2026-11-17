"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { t } from "../i18n";
import { useDemo } from "../store";
import { useNow } from "../use-now";
import { GiftCardBalance } from "./gift-card-balance";
import { Hero } from "./hero";
import { FindUs, OpeningHours, Reviews } from "./salon-info";
import { Treatments } from "./treatments";
import { BookingWizard } from "./wizard";

/** `/boka/salong-eko`: who we are, the booking box first (prices step aside while a booking is under way), then prices, reviews and hours. */
export function SalonPage() {
  const state = useDemo();
  const now = useNow();
  const fromLink = useSearchParams()?.get("service") ?? undefined;
  const [inFlow, setInFlow] = useState(false);
  const [preset, setPreset] = useState<{ serviceId: string; count: number }>();
  if (!state) return null;
  const initial = preset?.serviceId ?? (state.services.some((s) => s.id === fromLink) ? fromLink : undefined);

  const book = (serviceId: string) => {
    setPreset({ serviceId, count: (preset?.count ?? 0) + 1 });
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      <Hero state={state} now={now} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-10">
        <div className="min-w-0 space-y-8">
          <section id="book" className="scroll-mt-4" aria-label={t("booking.ask.title")}>
            <BookingWizard key={preset?.count ?? 0} state={state} now={now} initialServiceId={initial} onFlowChange={setInFlow} />
          </section>
          {!inFlow && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">{t("booking.treatments")}</h2>
              <Treatments state={state} onBook={book} />
            </section>
          )}
        </div>
        <aside className="min-w-0 space-y-8">
          <GiftCardBalance state={state} />
          <Reviews state={state} />
          <OpeningHours state={state} now={now} />
          <FindUs state={state} />
        </aside>
      </div>
    </div>
  );
}
