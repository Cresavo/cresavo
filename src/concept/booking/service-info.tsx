"use client";

import Image from "next/image";
import { useState } from "react";
import type { Service } from "../data/types";
import { t } from "../i18n";
import { formatDuration, formatMoney } from "../i18n/format";
import { PHOTOS, type PhotoId } from "../page/theme";
import { Button } from "../ui/button";
import { cx } from "../ui/cx";
import { Sheet } from "../ui/sheet";

const photoOf = (image: string | undefined): string | undefined => (image && image in PHOTOS ? PHOTOS[image as PhotoId] : undefined);

/**
 * The quiet "More info" action beside a treatment that has a longer text, and the sheet it opens.
 * A control of its own, never inside the row's Book action. Renders nothing for a treatment without the text.
 */
export function ServiceInfo({ service, onBook, className }: { service: Service; onBook: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!service.details) return null;
  const photo = photoOf(service.image);
  return (
    <>
      <Button variant="tertiary" className={cx("underline underline-offset-2", className)} aria-haspopup="dialog" aria-label={t("booking.moreInfoAbout", { service: service.name })} onClick={() => setOpen(true)}>
        {t("booking.moreInfo")}
      </Button>
      {open && (
        <Sheet
          open
          onClose={() => setOpen(false)}
          title={service.name}
          description={`${formatDuration(service.duration)} · ${formatMoney(service.price)}`}
          footer={<Button width="responsive" onClick={() => { setOpen(false); onBook(); }}>{t("booking.bookService", { service: service.name })}</Button>}
        >
          <div className="space-y-4 pt-2">
            {photo && (
              <div className="relative aspect-[2/1] overflow-hidden rounded-lg bg-surface-2">
                <Image src={photo} alt="" fill sizes="(min-width: 640px) 480px, 100vw" className="object-cover" />
              </div>
            )}
            <p className="max-w-reading whitespace-pre-line text-pretty text-body">{service.details}</p>
          </div>
        </Sheet>
      )}
    </>
  );
}
