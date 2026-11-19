import { IconButton } from "../../ui/button";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { JOURNAL_PHOTOS } from "../../customers/journal";
import type { JournalPhotos } from "../../data/types";
import { t } from "../../i18n";
import { cx } from "../../ui/cx";

type Slot = keyof JournalPhotos;
const SLOTS: Slot[] = ["before", "after"];

function Photo({ src, slot, className }: { src: string; slot: Slot; className?: string }) {
  return (
    <div className={cx("relative aspect-[4/3] overflow-hidden rounded-md bg-surface-2", className)}>
      <Image src={src} alt={t("journal.photo.alt", { which: t(`journal.photo.${slot}`).toLowerCase() })} fill sizes="(min-width: 640px) 240px, 45vw" className="object-cover" />
    </div>
  );
}

/** Before and after photos of an entry, read only. */
export function JournalPhotoPair({ photos }: { photos?: JournalPhotos }) {
  if (!photos?.before && !photos?.after) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {SLOTS.map((slot) => (
        <figure key={slot} className="space-y-1">
          {photos[slot] ? <Photo src={photos[slot]} slot={slot} /> : <div className="aspect-[4/3] rounded-md border border-dashed border-hairline" />}
          <figcaption className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{t(`journal.photo.${slot}`)}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Pick or remove the before and after demo photos. */
export function JournalPhotoPicker({ value, onChange }: { value: JournalPhotos; onChange: (photos: JournalPhotos) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("journal.photos")}</p>
      <div className="grid grid-cols-2 gap-3">
        {SLOTS.map((slot) => {
          const which = t(`journal.photo.${slot}`).toLowerCase();
          return (
            <div key={slot} className="space-y-2">
              {value[slot] ? (
                <div className="relative">
                  <Photo src={value[slot]} slot={slot} />
                  <IconButton
                    label={t("journal.photo.remove", { which })}
                    onClick={() => onChange({ ...value, [slot]: undefined })}
                    className="!absolute right-2 top-2 bg-surface text-text"
                  >
                    <X size={16} />
                  </IconButton>
                </div>
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hairline text-text-secondary">
                  <ImagePlus size={20} />
                  <span className="text-xs">{t("journal.photo.add", { which })}</span>
                </div>
              )}
              <div className="flex gap-2" role="group" aria-label={t("journal.photo.choose", { which })}>
                {JOURNAL_PHOTOS.map((src, index) => (
                  <IconButton
                    key={src}
                    label={`${t("journal.photo.choose", { which })} ${index + 1}`}
                    aria-pressed={value[slot] === src}
                    onClick={() => onChange({ ...value, [slot]: src })}
                    className={cx("relative size-11 overflow-hidden rounded-sm ring-1 ring-hairline", value[slot] === src && "ring-2 ring-action")}
                  >
                    <Image src={src} alt="" fill sizes="44px" className="object-cover" />
                  </IconButton>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
