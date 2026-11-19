import { formatTime } from "../i18n/format";
import Image from "next/image";
import { AtSign } from "lucide-react";
import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { PHOTOS, type PhotoId } from "../page/theme";
import { buttonClass } from "../ui/button";
import { StaffAvatar } from "../ui/avatar";
import { Card, Section } from "../ui/card";
import { cx } from "../ui/cx";

// The simple sections of the booking page: team, gallery, questions and the
// Instagram link. The others (hero, treatments, reviews, hours, gift cards)
// live next to the pieces they were made from.

export function StaffSection({ state, variant }: { state: DemoState; variant: string }) {
  return (
    <Section title={t("booking.team")}>
      {variant === "names" ? (
        <ul className="flex flex-wrap gap-2">
          {state.staff.map((person) => (
            <li key={person.id} className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-4 text-sm font-medium ring-1 ring-hairline">
              <StaffAvatar person={person} size="sm" />
              {person.firstName} {person.lastName}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {state.staff.map((person) => (
            <li key={person.id}>
              <Card className="flex h-full items-start gap-3 p-4">
                <StaffAvatar person={person} size="lg" />
                <div className="min-w-0">
                  <p className="font-semibold">{person.firstName} {person.lastName}</p>
                  <p className="text-sm text-text-secondary">{person.title}</p>
                  <p className="mt-1 text-sm">{person.bio}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const GALLERY: PhotoId[] = ["salon", "massage", "hair"];

export function GallerySection({ variant }: { variant: string }) {
  const strip = variant === "strip";
  return (
    <Section title={t("booking.gallery")}>
      <ul className={cx("grid gap-2", strip ? "grid-cols-3" : "grid-cols-2")}>
        {GALLERY.map((photo, index) => (
          <li key={photo} className={cx("relative overflow-hidden rounded-lg bg-surface-2", strip ? "aspect-[3/4]" : index === 0 ? "col-span-2 aspect-[2/1]" : "aspect-square")}>
            <Image src={PHOTOS[photo]} alt={t(`page.photo.${photo}`)} fill sizes="(min-width: 1024px) 480px, 50vw" className="object-cover" />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function FaqSection({ state, variant }: { state: DemoState; variant: string }) {
  const { salon } = state;
  const items = [
    { q: t("booking.faq.change.q"), a: t("booking.faq.change.a", { hours: state.cancellationPolicy.freeHours }) },
    { q: t("booking.faq.find.q"), a: t("booking.faq.find.a", { address: `${salon.address}, ${salon.area.split(" · ")[0]}`, phone: salon.phone }) },
    { q: t("booking.faq.hours.q"), a: salon.lunch ? t("booking.faq.hours.lunch", { from: formatTime(salon.lunch.start), to: formatTime(salon.lunch.end) }) : t("booking.faq.hours.a") },
  ];
  return (
    <Section title={t("booking.faq")}>
      <Card className="divide-y divide-hairline">
        {items.map((item) => (
          <details key={item.q} open={variant === "open"} className="group px-4">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden className="text-text-secondary transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="pb-4 text-[15px] text-text-secondary">{item.a}</p>
          </details>
        ))}
      </Card>
    </Section>
  );
}

export function InstagramSection({ handle, variant }: { handle: string; variant: string }) {
  if (!handle) return null;
  const href = `https://www.instagram.com/${handle}/`;
  return variant === "link" ? (
    <p className="text-sm">
      <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 font-medium text-action underline-offset-2 hover:underline">
        <AtSign size={16} />
        {t("booking.instagram.link", { handle })}
      </a>
    </p>
  ) : (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="min-w-0 flex-1 text-[15px]">{t("booking.instagram.text")}</p>
      <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
        <AtSign size={18} />
        {t("booking.instagram.button", { handle })}
      </a>
    </Card>
  );
}
