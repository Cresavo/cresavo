import { Dumbbell, Footprints, Hand, HandHeart, Palette, Scissors, Stethoscope, Users, type LucideIcon } from "lucide-react";
import type { Category, DemoState, Service } from "../data/types";
import { t } from "../i18n";
import { formatDuration, formatMoney } from "../i18n/format";

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  foot: Footprints,
  massage: HandHeart,
  cut: Scissors,
  colour: Palette,
  manicure: Hand,
  pedicure: Footprints,
  personal: Dumbbell,
  group: Users,
  physio: Stethoscope,
  recovery: HandHeart,
};

export function ServiceIcon({ category }: { category: Service["category"] }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-action-bg text-text">
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
        <span className="mt-0.5 block text-sm text-text-secondary">{service.description}</span>
        <span className="mt-1 block text-sm">
          {formatDuration(service.duration)} · <strong className="font-semibold">{formatMoney(service.price)}</strong> · {t("booking.withStaff", { name: names })}
        </span>
      </span>
    </span>
  );
}

