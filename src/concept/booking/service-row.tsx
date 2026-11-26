import Image from "next/image";
import { WithStaff } from "./with-staff";
import { CircleDot, Dumbbell, Footprints, Hand, HandHeart, Palette, Scissors, Stethoscope, Users, type LucideIcon } from "lucide-react";
import type { DemoState, Service } from "../data/types";
import { formatDuration, formatMoney } from "../i18n/format";
import { PHOTOS, type PhotoId } from "../page/theme";
import { ListRow } from "../ui/list-row";
import { ServiceInfo } from "./service-info";

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

const photoOf = (image: string | undefined) => (image && image in PHOTOS ? PHOTOS[image as PhotoId] : undefined);

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
  const row = (className?: string) => (
    <ListRow className={className} title={service.name} leading={photoOf(service.image)
      ? <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-surface-2"><Image src={photoOf(service.image)!} alt="" fill sizes="52px" className="object-cover" /></span>
      : <ServiceIcon category={service.category} />} onClick={onClick}
      meta={<>
        <span className="block">{service.description}</span>
        <span className="mt-1 block">{formatDuration(service.duration)} · <strong>{formatMoney(service.price)}</strong> · <WithStaff people={people} /></span>
      </>} />
  );
  if (!service.details) return row("bg-surface ring-1 ring-inset ring-input-border");
  // The row stays one button; "More info" sits under it as a control of its own, inside the same frame.
  return (
    <div className="rounded-md bg-surface ring-1 ring-inset ring-input-border">
      {row()}
      <ServiceInfo service={service} onBook={onClick} className="ml-14" />
    </div>
  );
}

