import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import { formatTime } from "../data/dates";
import { openingFor } from "../data/slots";
import type { DemoState } from "../data/types";
import { t, tc } from "../i18n";
import { PHOTOS, type PhotoId } from "../page/theme";
import type { Now } from "../use-now";
import { Badge } from "../ui/badge";
import { cx } from "../ui/cx";
import { reviewSummary } from "./reviews";

interface HeroProps {
  state: DemoState;
  now: Now;
  /** "photo": the salon photo behind the name; "plain": a calm colour block. */
  variant: string;
  photo: PhotoId;
}

/** Name, rating, address and whether it is open right now, over a photo or on a colour. */
export function Hero({ state, now, variant, photo }: HeroProps) {
  const { salon } = state;
  const { average, count } = reviewSummary(state.reviews);
  const hours = openingFor(salon, now.today);
  const open = !!hours && now.minutes >= hours.open && now.minutes < hours.close;
  const withPhoto = variant === "photo";
  return (
    <section className={cx("relative isolate overflow-hidden rounded-lg", withPhoto ? "bg-surface-2 text-white" : "bg-action-bg text-text")}>
      {withPhoto && (
        <>
          <Image src={PHOTOS[photo]} alt={t("booking.heroAlt", { name: salon.name })} fill priority sizes="(min-width: 1024px) 1024px, 100vw" className="-z-20 object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/30 to-black/5" />
        </>
      )}
      <div className={cx("flex flex-col justify-end gap-3 p-5 sm:p-8", withPhoto ? "min-h-64 sm:min-h-80" : "min-h-44 sm:min-h-52")}>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{salon.name}</h1>
          <p className={cx("mt-1 text-base", withPhoto ? "text-white/90" : "text-text-secondary")}>{salon.tagline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Star size={16} className="fill-amber-300 text-amber-300" />
            <strong>{average.toFixed(1)}</strong>
            <span className={withPhoto ? "text-white/80" : "text-text-secondary"}>({tc("booking.reviewCount", count)})</span>
          </span>
          <span className={cx("inline-flex items-center gap-1.5", withPhoto ? "text-white/90" : "text-text-secondary")}>
            <MapPin size={16} />
            {salon.address}, {salon.area.split(" · ")[1]}
          </span>
          {hours && (
            <Badge tone={open ? "accent" : "neutral"}>
              {open ? t("booking.openNow", { until: formatTime(hours.close) }) : t("booking.closedNow")}
            </Badge>
          )}
        </div>
      </div>
    </section>
  );
}
