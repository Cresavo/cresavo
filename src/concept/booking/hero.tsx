import { formatTime } from "../i18n/format";
import Image from "next/image";
import { Clock, Star } from "lucide-react";
import { openingFor } from "../data/slots";
import type { DemoState } from "../data/types";
import { t, tc } from "../i18n";
import { PHOTOS, type PhotoId } from "../page/theme";
import type { Now } from "../use-now";
import { Badge } from "../ui/badge";
import { buttonClass } from "../ui/button";
import { reviewSummary } from "./reviews";

interface HeroProps {
  state: DemoState;
  now: Now;
  /** "photo": the photo above the name; "plain": the name alone; "cover": the name on a tall photo; "split": name and photo side by side. */
  variant: string;
  photo: PhotoId;
}

/** The top of the page: a photo, then the name and the three facts a customer checks first (rating, where, open now). */
export function Hero({ state, now, variant, photo }: HeroProps) {
  const { salon } = state;
  const { average, count } = reviewSummary(state.modules.reviews ? state.reviews : []);
  const hours = openingFor(salon, now.today);
  const open = !!hours && now.minutes >= hours.open && now.minutes < hours.close;
  const image = (sizes: string) => <Image src={PHOTOS[photo]} alt={t("booking.heroAlt", { name: salon.name })} fill loading="eager" fetchPriority="high" sizes={sizes} className="object-cover" />;
  const facts = (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-text-secondary">
      {count > 0 && (
        <>
          <a href="#reviews" className="inline-flex min-h-target min-w-target items-center gap-1 underline-offset-2 hover:underline">
            <Star aria-hidden size={14} className="fill-text text-text" />
            <strong className="font-semibold text-text">{average.toFixed(1)}</strong>
            <span>({tc("booking.reviewCount", count)})</span>
          </a>
          <span aria-hidden>·</span>
        </>
      )}
      {salon.address && <a href="#find-us" className="inline-flex min-h-target min-w-target items-center underline-offset-2 hover:underline">
        {salon.address}, {salon.area.split(" · ")[1]}
      </a>}
      {hours && (
        <>
          {/* On a phone the opening status is a line of its own, so no separator is left dangling. */}
          {salon.address && <span aria-hidden className="hidden sm:inline">·</span>}
          <Badge icon={Clock} tone={open ? "accent" : "neutral"} className="w-full sm:w-auto">
            {open ? t("booking.openNow", { until: formatTime(hours.close) }) : t("booking.closedNow")}
          </Badge>
        </>
      )}
    </p>
  );
  if (variant === "cover") {
    return (
      <section className="space-y-3 sm:space-y-4">
        <div className="booking-hero-cover relative isolate flex items-end overflow-hidden rounded-lg bg-surface-2">
          {image("(min-width: 1024px) 1024px, 100vw")}
          <div className="booking-hero-shade relative w-full space-y-4 p-5 sm:p-8">
            <div>
              <h1 className="booking-hero-title break-words font-semibold">{salon.name}</h1>
              <p className="mt-2 text-h3">{salon.tagline}</p>
            </div>
            <a href="#book" className={buttonClass("primary", "lg", "booking-hero-cta")}>{t("booking.bookTime")}</a>
          </div>
        </div>
        {facts}
      </section>
    );
  }
  if (variant === "split") {
    return (
      <section className="grid items-center gap-5 lg:grid-cols-2 lg:gap-12 lg:py-4">
        <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-surface-2 lg:order-2 lg:aspect-[4/3]">{image("(min-width: 1024px) 480px, 100vw")}</div>
        <div className="space-y-4">
          <div>
            <h1 className="booking-hero-title break-words font-semibold">{salon.name}</h1>
            <p className="mt-2 text-h3 text-text-secondary">{salon.tagline}</p>
          </div>
          {facts}
          <a href="#book" className={buttonClass("primary", "lg")}>{t("booking.bookTime")}</a>
        </div>
      </section>
    );
  }
  return (
    <section className="space-y-3 sm:space-y-4">
      {variant === "photo" && <div className="relative aspect-[2/1] overflow-hidden rounded-lg bg-surface-2 sm:aspect-[3/1]">{image("(min-width: 1024px) 1024px, 100vw")}</div>}
      <div className="space-y-3">
        <div>
          <h1 className="break-words text-h1 font-semibold tracking-tight">{salon.name}</h1>
          <p className="mt-1 text-body text-text-secondary">{salon.tagline}</p>
        </div>
        {facts}
      </div>
    </section>
  );
}
