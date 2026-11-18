"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { DemoState } from "../data/types";
import { t } from "../i18n";
import type { PageSection } from "../page/sections";
import { usePublicDemo } from "../store";
import { useNow, type Now } from "../use-now";
import { GiftCardBalance } from "./gift-card-balance";
import { Hero } from "./hero";
import { usePage } from "./page-context";
import { FindUs, OpeningHours, Reviews } from "./salon-info";
import { FaqSection, GallerySection, InstagramSection, StaffSection } from "./sections";
import { Treatments } from "./treatments";
import { BookingWizard } from "./wizard";

/**
 * `/boka/<slug>`: the sections the owner chose, in their order, around the
 * booking flow, which is always the same and sits right after the hero. The
 * price list steps aside while a booking is under way (one next action).
 */
export function SalonPage() {
  const state = usePublicDemo();
  const now = useNow();
  const fromLink = useSearchParams()?.get("service") ?? undefined;
  const { sections, instagram, theme } = usePage();
  const [inFlow, setInFlow] = useState(false);
  const [preset, setPreset] = useState<{ serviceId: string; count: number }>();
  if (!state) return null;
  const initial = preset?.serviceId ?? (state.services.some((s) => s.id === fromLink) ? fromLink : undefined);

  const book = (serviceId: string) => {
    setPreset({ serviceId, count: (preset?.count ?? 0) + 1 });
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const render = ({ kind, variant }: PageSection): ReactNode => {
    switch (kind) {
      case "hero":
        return <Hero state={state} now={now} variant={variant} photo={theme.heroPhoto} />;
      case "treatments":
        return inFlow ? null : (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">{t("booking.treatments")}</h2>
            <Treatments state={state} onBook={book} compact={variant === "compact"} />
          </section>
        );
      case "staff":
        return <StaffSection state={state} variant={variant} />;
      case "reviews":
        return <Reviews state={state} variant={variant} />;
      case "gallery":
        return <GallerySection variant={variant} />;
      case "map":
        return <Location state={state} now={now} variant={variant} />;
      case "faq":
        return <FaqSection state={state} variant={variant} />;
      case "instagram":
        return <InstagramSection handle={instagram} variant={variant} />;
      case "giftcards":
        return <GiftCardBalance state={state} compact={variant === "compact"} />;
    }
  };

  const [first, ...rest] = sections;
  const topIsHero = first?.kind === "hero";
  const flow = (
    <section id="book" data-booking-flow className="scroll-mt-4" aria-label={t("booking.ask.title")}>
      <BookingWizard key={preset?.count ?? 0} state={state} now={now} initialServiceId={initial} onFlowChange={setInFlow} />
    </section>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {topIsHero && <div className="lg:-mx-12">{render(first)}</div>}
      {flow}
      {(topIsHero ? rest : sections).map((section) => {
        const node = render(section);
        return node ? <div key={section.kind}>{node}</div> : null;
      })}
    </div>
  );
}

/** Address and contact, with the opening hours when the section asks for the full look. */
function Location({ state, now, variant }: { state: DemoState; now: Now; variant: string }) {
  return (
    <div className="space-y-8">
      <FindUs state={state} />
      {variant === "full" && <OpeningHours state={state} now={now} />}
    </div>
  );
}
