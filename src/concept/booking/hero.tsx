import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import { formatTime } from "../data/dates";
import { openingFor } from "../data/slots";
import type { DemoState } from "../data/types";
import { t, tc } from "../i18n";
import type { Now } from "../use-now";
import { Badge } from "../ui/badge";
import { reviewSummary } from "./reviews";

/** Salon photo with name, rating, address and whether it is open right now. */
export function Hero({ state, now }: { state: DemoState; now: Now }) {
  const { salon } = state;
  const { average, count } = reviewSummary(state.reviews);
  const hours = openingFor(salon, now.today);
  const open = !!hours && now.minutes >= hours.open && now.minutes < hours.close;
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-eko-sunken text-white shadow-card">
      <Image src="/demo/salon.webp" alt={t("booking.heroAlt", { name: salon.name })} fill priority sizes="(min-width: 1024px) 1024px, 100vw" className="-z-20 object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/30 to-black/5" />
      <div className="flex min-h-64 flex-col justify-end gap-3 p-5 sm:min-h-80 sm:p-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{salon.name}</h1>
          <p className="mt-1 text-base text-white/90">{salon.tagline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Star size={16} className="fill-amber-300 text-amber-300" />
            <strong>{average.toFixed(1)}</strong>
            <span className="text-white/80">({tc("booking.reviewCount", count)})</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-white/90">
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
