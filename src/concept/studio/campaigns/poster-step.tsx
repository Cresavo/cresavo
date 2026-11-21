import { useRef, useState } from "react";
import { Download, ImagePlus, Share2 } from "lucide-react";
import { draftLink, resolvePoster, type Draft } from "../../campaigns/draft";
import { downloadBlob, posterToPng, sharePoster } from "../../campaigns/export-png";
import { isOwnPhoto, ownPhotoUrl } from "../../campaigns/own-photo";
import { POSTER_FORMATS, POSTER_IMAGES, POSTER_STYLES } from "../../campaigns/poster-layout";
import type { DemoState, PosterFocus, PosterFormat, PosterTextSize } from "../../data/types";
import { t } from "../../i18n";
import { Button, buttonClass } from "../../ui/button";
import { cx } from "../../ui/cx";
import { Notice } from "../../ui/notice";
import { Field, Segmented, TextInput } from "../../ui/controls";
import { showToast } from "../../ui/toast";
import { PosterView } from "./poster-view";

const FORMATS = Object.keys(POSTER_FORMATS) as PosterFormat[];
const TEXT_SIZES: PosterTextSize[] = ["small", "normal", "large"];
const FOCUSES: PosterFocus[] = ["top", "center", "bottom"];

interface PosterStepProps {
  state: DemoState;
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}

/** Step 3: pick a style and photo, adjust the text, export a PNG in the size a channel wants. */
export function PosterStep({ state, draft, onChange }: PosterStepProps) {
  const [format, setFormat] = useState<PosterFormat>("post");
  const svg = useRef<SVGSVGElement>(null);
  const poster = resolvePoster(state, draft);
  const source = { name: draft.name, to: draft.to, link: draftLink(state, draft), poster };
  const edit = (patch: Draft["posterEdits"]) => onChange({ posterEdits: { ...draft.posterEdits, ...patch } });

  const download = async () => {
    if (!svg.current) return;
    try {
      downloadBlob(await posterToPng(svg.current, format), `poster-${format}.png`);
      showToast(t("campaigns.poster.saved"));
    } catch {
      showToast(t("campaigns.poster.failed"));
    }
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      edit({ image: await ownPhotoUrl(file) });
    } catch {
      showToast(t("campaigns.photo.failed"));
    }
  };

  const share = async () => {
    if (!svg.current) return;
    try {
      const blob = await posterToPng(svg.current, format);
      if (!(await sharePoster(blob, `poster-${format}.png`, `${poster.headline} ${poster.detail}`))) {
        downloadBlob(blob, `poster-${format}.png`);
        showToast(t("campaigns.poster.saved"));
      }
    } catch {
      showToast(t("campaigns.poster.failed"));
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Segmented<PosterFormat>
          label={t("campaigns.poster.format")}
          value={format}
          onChange={setFormat}
          options={FORMATS.map((value) => ({ value, label: t(`campaigns.format.${value}`) }))}
        />
        <div className={cx("mx-auto w-full overflow-hidden rounded-lg", format === "post" ? "max-w-sm" : "max-w-64")}>
          <PosterView ref={svg} source={source} salon={state.salon} format={format} />
        </div>
        <Button width="responsive" icon={<Share2 size={18} />} onClick={share}>{t("campaigns.poster.share")}</Button>
        <Button variant="secondary" width="responsive" icon={<Download size={18} />} onClick={download}>
          {t("campaigns.poster.download", { size: `${POSTER_FORMATS[format].width * POSTER_FORMATS[format].exportScale} × ${POSTER_FORMATS[format].height * POSTER_FORMATS[format].exportScale}` })}
        </Button>
      </div>
      <div className="space-y-5">
        <div className="space-y-2">
          <span className="block text-sm font-medium">{t("campaigns.poster.style")}</span>
          <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label={t("campaigns.poster.style")}>
            {POSTER_STYLES.map((style) => (
              <Button variant="secondary" size="sm"
                key={style}
                role="radio"
                aria-checked={draft.style === style}
                aria-label={t(`campaigns.style.${style}`)}
                onClick={() => onChange({ style })}
                className={cx("w-20 shrink-0 flex-col !gap-1 !p-1 !text-minimum", draft.style === style ? "!ring-2 ring-action" : "ring-input-border")}
              >
                <span className="pointer-events-none block overflow-hidden rounded-sm">
                  <PosterView source={{ ...source, poster: { ...poster, style } }} salon={state.salon} format="post" />
                </span>
                {t(`campaigns.style.${style}`)}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <span className="block text-sm font-medium">{t("campaigns.poster.photo")}</span>
          <div className="flex flex-wrap gap-2">
            {POSTER_IMAGES.map((image) => (
              <Button variant="secondary" size="sm"
                key={image}
                aria-pressed={poster.image === image}
                aria-label={t(image.includes("massage") ? "campaigns.photo.massage" : "campaigns.photo.salon")}
                onClick={() => edit({ image })}
                className={cx("h-16 w-24 overflow-hidden bg-cover bg-center", poster.image === image ? "!ring-2 ring-action" : "ring-input-border")}
                style={{ backgroundImage: `url(${image})` }}
              />
            ))}
            <label className={cx(buttonClass("secondary", "sm"), "h-16 w-24 cursor-pointer flex-col !gap-1 !text-minimum", poster.image && isOwnPhoto(poster.image) && "!ring-2 ring-action")}>
              <ImagePlus size={18} aria-hidden />
              {t("campaigns.photo.own")}
              <TextInput type="file" accept="image/*" className="sr-only" onChange={(event) => { void pickPhoto(event.target.files?.[0]); event.target.value = ""; }} />
            </label>
          </div>
          {poster.image && isOwnPhoto(poster.image) && <Notice tone="info">{t("campaigns.photo.ownNotice")}</Notice>}
        </div>
        <span className="block text-sm font-medium" aria-hidden>{t("campaigns.poster.textSize")}</span>
        <Segmented<PosterTextSize>
          label={t("campaigns.poster.textSize")}
          value={poster.textSize ?? "normal"}
          onChange={(textSize) => edit({ textSize })}
          options={TEXT_SIZES.map((value) => ({ value, label: t(`campaigns.textSize.${value}`) }))}
        />
        <span className="block text-sm font-medium" aria-hidden>{t("campaigns.poster.focus")}</span>
        <Segmented<PosterFocus>
          label={t("campaigns.poster.focus")}
          value={poster.focus ?? "center"}
          onChange={(focus) => edit({ focus })}
          options={FOCUSES.map((value) => ({ value, label: t(`campaigns.focus.${value}`) }))}
        />
        <Field width="short" label={t("campaigns.poster.headline")}>
          <TextInput value={poster.headline} maxLength={24} onChange={(event) => edit({ headline: event.target.value })} />
        </Field>
        <Field label={t("campaigns.poster.detail")}>
          <TextInput value={poster.detail} maxLength={70} onChange={(event) => edit({ detail: event.target.value })} />
        </Field>
      </div>
    </div>
  );
}
