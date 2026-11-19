"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { DemoState } from "../data/types";
import { t } from "../i18n";
import type { PageSection } from "../page/sections";
import { usePublicDemo } from "../store";
import { cx } from "../ui/cx";
import { useSalonNow, type Now } from "../use-now";
import { GiftCardBalance } from "./gift-card-balance";
import { Hero } from "./hero";
import { usePage } from "./page-context";
import { CancellationPolicy, FindUs, OpeningHours, Reviews } from "./salon-info";
import { FaqSection, GallerySection, InstagramSection, StaffSection } from "./sections";
import { Treatments } from "./treatments";
import { BookingWizard } from "./wizard";

/**
 * `/boka/<slug>`: the sections the owner chose, in their order, around the
 * booking flow, which is always the same and sits right after the hero: one
 * quiet line until a booking starts. The price list steps aside while a
 * booking is under way (one next action).
 */
export function SalonPage() {
  const state = usePublicDemo();
  const now = useSalonNow();
  const params = useSearchParams();
  const fromLink = params?.get("service") ?? undefined;
  const { sections, instagram, theme } = usePage();
  const [inFlow, setInFlow] = useState(false);
  const [preset, setPreset] = useState<{ serviceId: string; count: number }>();
  if (!state) return null;
  const initial = preset?.serviceId ?? (state.services.some((s) => s.id === fromLink) ? fromLink : undefined);

  const book = (serviceId: string) => {
    setPreset({ serviceId, count: (preset?.count ?? 0) + 1 });
    document.getElementById("book")?.scrollIntoView({ behavior: "instant", block: "start" });
  };

  const render = ({ kind, variant }: PageSection): ReactNode => {
    switch (kind) {
      case "hero":
        return <Hero state={state} now={now} variant={variant} photo={theme.heroPhoto} />;
      case "treatments":
        return inFlow || !state.services.length ? null : (
          <section className="space-y-4">
            <h2 className="text-h2 font-semibold tracking-tight">{t("booking.treatments")}</h2>
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
      {!state.services.length ? <p className="rounded-lg bg-surface p-4">{t("booking.menuSoon")}</p> : <BookingWizard key={preset?.count ?? params?.toString()} state={state} now={now} initialServiceId={initial} initialStaffId={preset ? undefined : state.staff.find(person => person.id === params?.get("staff"))?.id} onFlowChange={setInFlow} listOnPage={sections.some((s) => s.kind === "treatments")} />}
    </section>
  );
  const policy = <CancellationPolicy state={state} />;
  // The practical facts (where, when, how to reach us, what cancelling costs) are one block: in the
  // owner's order on a phone, a column of its own beside the price list on a wide screen.
  const body = (topIsHero ? rest : sections).flatMap((section) => {
    const node = render(section);
    return node ? [{ key: section.kind as string, node: section.kind === "map" ? <div className="space-y-6">{node}{policy}</div> : node, aside: section.kind === "map" }] : [];
  });
  if (!body.some((item) => item.aside)) body.push({ key: "policy", node: policy, aside: true });
  const asideRows = Math.max(1, body.filter((item) => !item.aside).length + (inFlow ? 0 : 1));
  return (
    <div className="mx-auto max-w-3xl space-y-6 lg:max-w-none lg:space-y-8">
      {topIsHero && render(first)}
      <div className="booking-page-columns space-y-8 lg:grid lg:items-start lg:gap-x-12 lg:gap-y-8 lg:space-y-0">
        <div className={cx("min-w-0 lg:col-start-1", inFlow && "lg:col-span-2")}>{flow}</div>
        {body.map((item) =>
          item.aside ? (
            <aside key={item.key} className={cx("min-w-0 lg:sticky lg:top-6 lg:col-start-2", inFlow ? "lg:row-start-2" : "lg:row-start-1")} style={{ gridRowEnd: `span ${asideRows}` }}>{item.node}</aside>
          ) : (
            <div key={item.key} className="min-w-0 lg:col-start-1">{item.node}</div>
          ),
        )}
      </div>
    </div>
  );
}

/** Address and contact, with the opening hours when the section asks for the full look. */
function Location({ state, now, variant }: { state: DemoState; now: Now; variant: string }) {
  return (
    <div className="space-y-6">
      {variant === "full" && <OpeningHours state={state} now={now} />}
      {state.salon.address && <FindUs state={state} />}
    </div>
  );
}
