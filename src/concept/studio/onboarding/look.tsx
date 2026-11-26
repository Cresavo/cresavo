"use client";

import { useId, useRef } from "react";
import { ImagePlus, Leaf } from "lucide-react";
import { themeAttributes } from "../../booking/page-root";
import { t } from "../../i18n";
import { formatDuration, formatMoney } from "../../i18n/format";
import { SETUP_ACCENTS, type SalonDraft } from "../../onboarding/salon";
import { DEFAULT_THEME, PALETTES } from "../../page/theme";
import { Button } from "../../ui/button";
import { Chip, Input } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { showToast } from "../../ui/toast";
import { readLogo } from "../page/read-logo";

type Look = Partial<Pick<SalonDraft, "accent" | "logo">>;

interface Props {
  draft: SalonDraft;
  name: string;
  change: (patch: Look) => void;
}

/** A logo and one colour, with the top of the booking page wearing them as they change. */
export function SetupLook({ draft, name, change }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const coloursId = useId();
  const pick = async (picked: File | undefined) => {
    if (!picked) return;
    const small = await readLogo(picked);
    if (!small) return showToast(t("pageEditor.logo.failed"));
    change({ logo: small.logo });
  };
  return <div className="space-y-6">
    <LookPreview draft={draft} name={name} />
    <div className="space-y-2">
      <p id={coloursId} className="text-body font-medium">{t("setup.colour")}</p>
      <div role="group" aria-labelledby={coloursId} className="flex flex-wrap gap-2">
        <Chip active={!draft.accent} onClick={() => change({ accent: null })}>
          <span aria-hidden className="size-4 rounded-full bg-text ring-1 ring-hairline" />{t("page.palette.default")}
        </Chip>
        {SETUP_ACCENTS.map(id => <Chip key={id} active={draft.accent === id} onClick={() => change({ accent: id })}>
          {/* The swatch is the palette's own colour: data, not a studio colour. */}
          <span aria-hidden className="size-4 rounded-full ring-1 ring-hairline" style={{ background: PALETTES[id].accent }} />{t(`page.palette.${id}`)}
        </Chip>)}
      </div>
    </div>
    <div className="space-y-2">
      <p className="text-body font-medium">{t("setup.logo")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" icon={<ImagePlus size={18} />} onClick={() => file.current?.click()}>
          {t(draft.logo ? "pageEditor.logo.change" : "pageEditor.logo.add")}
        </Button>
        {draft.logo && <Button variant="ghost" onClick={() => change({ logo: null })}>{t("pageEditor.logo.remove")}</Button>}
        <Input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label={t("pageEditor.logo.add")}
          onChange={event => { void pick(event.target.files?.[0]); event.target.value = ""; }} />
      </div>
    </div>
  </div>;
}

/** The booking page's header and first treatment, drawn with the page's own theme so the colours are the real ones. */
function LookPreview({ draft, name }: { draft: SalonDraft; name: string }) {
  const theme = { ...DEFAULT_THEME, logo: draft.logo, colors: draft.accent ? PALETTES[draft.accent] : null };
  const { className, ...attributes } = themeAttributes(theme);
  const first = draft.treatments[0];
  return <figure className="space-y-2">
    <figcaption className="text-meta text-text-secondary">{t("setup.preview")}</figcaption>
    <div {...attributes} className={cx(className, "overflow-hidden rounded-lg bg-bg text-text ring-1 ring-hairline")}>
      <div className="flex min-h-14 items-center gap-3 border-b border-hairline bg-surface px-4 font-semibold tracking-tight">
        {draft.logo
          // A small data URL made in this browser; nothing for the image optimiser to do.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={draft.logo} alt={t("pageEditor.logo.alt")} className="h-8 w-auto max-w-32 rounded-sm object-contain" />
          : <span aria-hidden className="flex size-8 items-center justify-center rounded-sm bg-action text-on-action"><Leaf size={16} /></span>}
        <span className="min-w-0 break-words">{name}</span>
      </div>
      {first && <div className="flex items-center gap-3 px-4 py-4">
        <span className="min-w-0 flex-1 break-words">
          <span className="block text-body font-medium">{first.name}</span>
          <span className="block text-meta text-text-secondary">{formatDuration(first.duration)} · {formatMoney(first.price, draft.currency, draft.language)}</span>
        </span>
        <span aria-hidden className="rounded-full bg-action px-4 py-2 text-body font-medium text-on-action">{t("booking.book")}</span>
      </div>}
    </div>
  </figure>;
}
