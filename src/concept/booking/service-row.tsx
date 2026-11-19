import { WithStaff } from "./with-staff";
import { CircleDot, Dumbbell, Footprints, Hand, HandHeart, Palette, Scissors, Stethoscope, Users, type LucideIcon } from "lucide-react";
import type { DemoState, Service } from "../data/types";
import { formatDuration, formatMoney } from "../i18n/format";
import { ListRow } from "../ui/list-row";

// The industry packs' own categories have a picture; a category the owner added gets a neutral one.
const CATEGORY_ICON: Partial<Record<string, LucideIcon>> = {
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
  const Icon = CATEGORY_ICON[category] ?? CircleDot;
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-action-bg text-text">
      <Icon size={20} aria-hidden />
    </span>
  );
}

export function ServiceChoice({ service, staff, onClick }: { service: Service; staff: DemoState["staff"]; onClick: () => void }) {
  const people = staff.filter((s) => service.staffIds.includes(s.id));
  return (
    <ListRow className="bg-surface ring-1 ring-inset ring-input-border" title={service.name} leading={<ServiceIcon category={service.category} />} onClick={onClick}
      meta={<>
        <span className="block">{service.description}</span>
        <span className="mt-1 block">{formatDuration(service.duration)} · <strong>{formatMoney(service.price)}</strong> · <WithStaff people={people} /></span>
      </>} />
  );
}

