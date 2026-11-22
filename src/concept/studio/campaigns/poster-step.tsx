import { useRef, useState } from "react";
import { reviewSummary } from "../../booking/reviews";
import { Download, ImagePlus, Share2 } from "lucide-react";
import { draftLink, resolvePoster, type Draft } from "../../campaigns/draft";
import { downloadBlob, posterToPng, sharePoster } from "../../campaigns/export-png";
import { isOwnPhoto, ownPhotoUrl } from "../../campaigns/own-photo";
import { GOAL_STYLES } from "../../campaigns/goals";
import { BACKDROPS, type Backdrop } from "../../campaigns/poster-engine/backdrops";
import { headlineTooLong, isEngineStyle, MAX_BADGES, POSTER_FORMATS, POSTER_IMAGES, POSTER_STYLES, WELLNESS_BADGES } from "../../campaigns/poster-layout";
import type { DemoState, PosterFocus, PosterFormat, PosterTextSize } from "../../data/types";
import { t } from "../../i18n";
import { Button, buttonClass } from "../../ui/button";
import { cx } from "../../ui/cx";
import { Notice } from "../../ui/notice";
import { Checkbox, Field, Segmented, TextInput } from "../../ui/controls";
import { showToast } from "../../ui/toast";
import { PosterView } from "./poster-view";

const FORMATS = Object.keys(POSTER_FORMATS) as PosterFormat[];
const TEXT_SIZES: PosterTextSize[] = ["small", "normal", "large"];
const FOCUSES: PosterFocus[] = ["top", "center", "bottom"];

interface PosterStepProps {
  state: DemoState;
  draft: Draft;
  onChange: (patch: Partial<Draft> | ((current: Draft) => Partial<Draft>)) => void;
}

/** Step 3: pick a style and photo, adjust the text, export a PNG in the size a channel wants. */
export function PosterStep({ state, draft, onChange }: PosterStepProps) {
  const [format, setFormat] = useState<PosterFormat>("post");
  const svg = useRef<SVGSVGElement>(null);
  const poster = resolvePoster(state, draft);
  const source = { name: draft.name, to: draft.to, link: draftLink(state, draft), poster };
  const edit = (patch: Draft["posterEdits"]) => onChange((current) => ({ posterEdits: { ...current.posterEdits, ...patch } }));
  const badges = poster.badges ?? [];
  const staffPhotos = state.staff.flatMap((member) => (member.photo ? [{ src: member.photo, label: `${member.firstName} ${member.lastName}` }] : []));
  const toggleBadge = (badge: string) =>
    edit({ badges: badges.includes(badge) ? badges.filter((b) => b !== badge) : WELLNESS_BADGES.filter((b) => b === badge || badges.includes(b)) });

  const download = async () => {
    if (!svg.current) return;
    try {
      downloadBlob(await posterToPng(svg.current, format), `poster-${format}.png`);
      showToast(t("campaigns.poster.saved"));
    } catch {
      showToast(t("campaigns.poster.failed"));
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
          <PosterView ref={svg} source={source} salon={state.salon} theme={state.page.theme} rating={reviewSummary(state.reviews)} language={state.localization.language} format={format} />
        </div>
        <Button width="responsive" icon={<Share2 size={18} />} onClick={share}>{t("campaigns.poster.share")}</Button>
        <Button variant="secondary" width="responsive" icon={<Download size={18} />} onClick={download}>
          {t("campaigns.poster.download", { size: `${POSTER_FORMATS[format].width * POSTER_FORMATS[format].exportScale} × ${POSTER_FORMATS[format].height * POSTER_FORMATS[format].exportScale}` })}
        </Button>
      </div>
      <div className="space-y-5">
        {draft.goal && (
          <div className="space-y-2">
            <span className="block text-sm font-medium">{t("campaigns.goal.suggestions")}</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("campaigns.goal.suggestions")}>
              {GOAL_STYLES[draft.goal].map((style) => (
                <Button variant="secondary" size="sm"
                  key={style}
                  role="radio"
                  aria-checked={draft.style === style}
                  aria-label={t(`campaigns.style.${style}`)}
                  onClick={() => onChange({ style })}
                  className={cx("flex-col !gap-1 !p-1 !text-minimum", draft.style === style ? "!ring-2 ring-action" : "ring-input-border")}
                >
                  <span className="pointer-events-none block w-full overflow-hidden rounded-sm">
                    <PosterView source={{ ...source, poster: resolvePoster(state, { ...draft, style }) }} salon={state.salon} theme={state.page.theme} rating={reviewSummary(state.reviews)} language={state.localization.language} format="post" />
                  </span>
                  {t(`campaigns.style.${style}`)}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-2">
          <span className="block text-sm font-medium">{t(draft.goal ? "campaigns.goal.moreStyles" : "campaigns.poster.style")}</span>
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
                  <PosterView source={{ ...source, poster: resolvePoster(state, { ...draft, style }) }} salon={state.salon} theme={state.page.theme} rating={reviewSummary(state.reviews)} language={state.localization.language} format="post" />
                </span>
                {t(`campaigns.style.${style}`)}
              </Button>
            ))}
          </div>
        </div>
        {draft.style === "beforeafter" ? (
          <>
            <PhotoPicker label={t("campaigns.photo.before")} value={poster.before} onPick={(before) => edit({ before })} />
            <PhotoPicker label={t("campaigns.photo.after")} value={poster.image} onPick={(image) => edit({ image })} />
          </>
        ) : draft.style === "portrait" ? (
          <>
            <PhotoPicker label={t("campaigns.photo.person")} value={poster.image} onPick={(image) => edit({ image })} images={staffPhotos} />
            <p className="text-sm text-text-secondary">{t("campaigns.photo.cutoutTip")}</p>
            <span className="block text-sm font-medium" aria-hidden>{t("campaigns.poster.backdrop")}</span>
            <Segmented<Backdrop>
              label={t("campaigns.poster.backdrop")}
              value={poster.backdrop ?? "bloom"}
              onChange={(backdrop) => edit({ backdrop })}
              options={BACKDROPS.map((value) => ({ value, label: t(`campaigns.backdrop.${value}`) }))}
            />
          </>
        ) : (
          <PhotoPicker label={t("campaigns.poster.photo")} value={poster.image} onPick={(image) => edit({ image })} />
        )}
        {[poster.image, draft.style === "beforeafter" ? poster.before : undefined].some((image) => image && isOwnPhoto(image)) && <Notice tone="info">{t("campaigns.photo.ownNotice")}</Notice>}
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
        {(draft.style === "price" || draft.style === "pricelist" || draft.style === "portrait") && (
          <fieldset className="space-y-2">
            <legend className="block text-sm font-medium">{t("campaigns.poster.badges")}</legend>
            <div className="flex flex-wrap gap-2">
              {WELLNESS_BADGES.map((badge) => (
                <Button variant="secondary" size="sm" key={badge}
                  aria-pressed={badges.includes(badge)}
                  disabled={!badges.includes(badge) && badges.length >= MAX_BADGES}
                  onClick={() => toggleBadge(badge)}
                  className={cx(badges.includes(badge) ? "!ring-2 ring-action" : "ring-input-border")}
                >
                  {badge}
                </Button>
              ))}
            </div>
            <p className="text-sm text-text-secondary">{t("campaigns.poster.badgesHint")}</p>
          </fieldset>
        )}
        {isEngineStyle(draft.style) && (
          <Checkbox label={t("campaigns.poster.socialQr")} checked={!!poster.socialQr} onChange={(event) => edit({ socialQr: event.target.checked })} />
        )}
        {draft.style === "portrait" && (
          <Field width="short" label={t("campaigns.poster.lead")}>
            <TextInput value={poster.lead ?? ""} maxLength={30} onChange={(event) => edit({ lead: event.target.value })} />
          </Field>
        )}
        <Field width="short" label={t("campaigns.poster.headline")}>
          <TextInput value={poster.headline} maxLength={24} onChange={(event) => edit({ headline: event.target.value })} />
        </Field>
        {isEngineStyle(draft.style) && headlineTooLong(poster.headline) && <Notice tone="info">{t("campaigns.poster.headlineLong")}</Notice>}
        <Field label={t("campaigns.poster.detail")}>
          <TextInput value={poster.detail} maxLength={70} onChange={(event) => edit({ detail: event.target.value })} />
        </Field>
      </div>
    </div>
  );
}

const ROOM_PHOTOS = POSTER_IMAGES.map((src) => ({ src, label: src.includes("massage") ? "campaigns.photo.massage" as const : "campaigns.photo.salon" as const }));

/** The demo photos (each with its accessible name) and the owner's own photo, for one photo slot on the poster. */
function PhotoPicker({ label, value, onPick, images }: { label: string; value: string | undefined; onPick: (image: string) => void; images?: { src: string; label: string }[] }) {
  const choices = images ?? ROOM_PHOTOS.map((photo) => ({ src: photo.src, label: t(photo.label) }));
  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      onPick(await ownPhotoUrl(file));
    } catch {
      showToast(t("campaigns.photo.failed"));
    }
  };
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {choices.map(({ src, label: name }) => (
          <Button variant="secondary" size="sm"
            key={src}
            aria-pressed={value === src}
            aria-label={name}
            onClick={() => onPick(src)}
            className={cx("h-16 w-24 overflow-hidden bg-cover bg-center", value === src ? "!ring-2 ring-action" : "ring-input-border")}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
        <label className={cx(buttonClass("secondary", "sm"), "h-16 w-24 cursor-pointer flex-col !gap-1 !text-minimum", value && isOwnPhoto(value) && "!ring-2 ring-action")}>
          <ImagePlus size={18} aria-hidden />
          {t("campaigns.photo.own")}
          <TextInput type="file" accept="image/*" className="sr-only" onChange={(event) => { void pick(event.target.files?.[0]); event.target.value = ""; }} />
        </label>
      </div>
    </div>
  );
}
