import { Footprints, HandHeart } from "lucide-react";
import type { DemoState, Service } from "../data/types";
import { t } from "../i18n";
import { formatDuration, formatMoney } from "../i18n/format";

export function ServiceIcon({ category }: { category: Service["category"] }) {
  const Icon = category === "foot" ? Footprints : HandHeart;
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-eko-accent-soft text-eko-accent">
      <Icon size={20} />
    </span>
  );
}

/** Icon, name, description and "60 min · SEK 795 · with Anna". The caller adds the tap target. */
export function ServiceInfo({ service, staff }: { service: Service; staff: DemoState["staff"] }) {
  const names = staff.filter((s) => service.staffIds.includes(s.id)).map((s) => s.firstName).join(", ");
  return (
    <span className="flex min-w-0 flex-1 items-start gap-3">
      <ServiceIcon category={service.category} />
      <span className="min-w-0">
        <span className="block font-medium">{service.name}</span>
        <span className="mt-0.5 block text-sm text-eko-muted">{service.description}</span>
        <span className="mt-1 block text-sm">
          {formatDuration(service.duration)} · <strong className="font-semibold">{formatMoney(service.price)}</strong> · {t("booking.withStaff", { name: names })}
        </span>
      </span>
    </span>
  );
}

export const CATEGORY_LABEL = { foot: "booking.category.foot", massage: "booking.category.massage" } as const;
