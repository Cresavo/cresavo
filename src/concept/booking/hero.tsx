import { formatTime } from "../i18n/format";
import Image from "next/image";
import { Star } from "lucide-react";
import { openingFor } from "../data/slots";
import type { DemoState } from "../data/types";
import { t, tc } from "../i18n";
import { PHOTOS, type PhotoId } from "../page/theme";
import type { Now } from "../use-now";
import { cx } from "../ui/cx";
import { reviewSummary } from "./reviews";

interface HeroProps {
  state: DemoState;
  now: Now;
  /** "photo": the salon photo above the name; "plain": the name alone. */
  variant: string;
  photo: PhotoId;
}

/** The top of the page: a photo, then the name and the three facts a customer checks first (rating, where, open now). */
export function Hero({ state, now, variant, photo }: HeroProps) {
  const { salon } = state;
  const { average, count } = reviewSummary(state.reviews);
  const hours = openingFor(salon, now.today);
  const open = !!hours && now.minutes >= hours.open && now.minutes < hours.close;
  return (
    <section className="space-y-3 sm:space-y-4">
      {variant === "photo" && (
        <div className="relative aspect-[2/1] overflow-hidden rounded-lg bg-surface-2 sm:aspect-[3/1]">
          <Image src={PHOTOS[photo]} alt={t("booking.heroAlt", { name: salon.name })} fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover" />
        </div>
      )}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{salon.name}</h1>
        <p className="mt-1 text-base text-text-secondary">{salon.tagline}</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
          {count > 0 && (
            <>
              <a href="#reviews" className="inline-flex min-h-6 items-center gap-1 underline-offset-2 hover:underline">
                <Star aria-hidden size={14} className="fill-text text-text" />
                <strong className="font-semibold text-text">{average.toFixed(1)}</strong>
                <span>({tc("booking.reviewCount", count)})</span>
              </a>
              <span aria-hidden>·</span>
            </>
          )}
          {salon.address && <a href="#find-us" className="inline-flex min-h-6 items-center underline-offset-2 hover:underline">
            {salon.address}, {salon.area.split(" · ")[1]}
          </a>}
          {hours && (
            <>
              {/* On a phone the opening status is a line of its own, so no separator is left dangling. */}
              {salon.address && <span aria-hidden className="hidden sm:inline">·</span>}
              <span className={cx("w-full sm:w-auto", open && "font-medium text-text")}>{open ? t("booking.openNow", { until: formatTime(hours.close) }) : t("booking.closedNow")}</span>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
