"use client";

import { useId, useState } from "react";
import { ImagePlus, Images, Megaphone, Trash2 } from "lucide-react";
import { MAX_PHOTOS } from "@/lib/media/limits";
import { currentSession, deletePicture, describePicture, photosOf, restorePicture, uploadPicture, useLibrary, type MediaSummary } from "../../media/library-client";
import { t, tc } from "../../i18n";
import { moduleEnabled } from "../../modules/registry";
import { PHOTOS, type PhotoId } from "../../page/theme";
import { useActiveWorkspace } from "../../store";
import { buttonClass, Button, ButtonLink } from "../../ui/button";
import { Card } from "../../ui/card";
import { cx } from "../../ui/cx";
import { Field, TextInput } from "../../ui/controls";
import { EmptyState } from "../../ui/empty-state";
import { StatusDot } from "../../ui/feedback";
import { Notice } from "../../ui/notice";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";

export const PHOTOS_PAGE = "/studio/more/photos";

/** Photos: the signed-in owner's own pictures, uploaded from the phone. The demo, which stores nothing, shows its sample photos. */
export function PhotoLibrary() {
  return useActiveWorkspace() === "account" ? <AccountLibrary /> : <DemoLibrary />;
}

function DemoLibrary() {
  return (
    <div className="space-y-6 md:max-w-4xl">
      <Notice tone="info">{t("photos.demo")}</Notice>
      <ButtonLink href="/account/signup" variant="secondary">{t("photos.demo.signup")}</ButtonLink>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label={t("photos.demo.samples")}>
        {(Object.keys(PHOTOS) as PhotoId[]).map((id) => (
          <li key={id}>
            <figure className="overflow-hidden rounded-lg bg-surface ring-1 ring-hairline">
              {/* The caption names the photo. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- a sample photo from /public/demo */}
              <img src={PHOTOS[id]} alt="" className="aspect-square w-full object-cover" />
              <figcaption className="px-3 py-2 text-meta text-text-secondary">{t(`page.photo.${id}`)}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AccountLibrary() {
  const { state } = useStudio();
  const library = useLibrary();
  const photos = photosOf(library);
  const [busy, setBusy] = useState(0);
  const campaigns = moduleEnabled(state.modules, "campaigns");

  const add = async (files: File[]) => {
    setBusy(files.length);
    // The whole batch belongs to the session it was picked in.
    const bound = await currentSession();
    let added = 0;
    for (const file of files) {
      const answer = await uploadPicture(file, "photo", bound);
      setBusy((left) => left - 1);
      if (answer.ok) added += answer.deduped ? 0 : 1;
      else showToast(t(answer.error));
    }
    if (added) showToast(tc("photos.added", added));
  };

  return (
    <div className="space-y-6 md:max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <label className={cx(buttonClass("primary"), "cursor-pointer focus-within:ring-2 focus-within:ring-action focus-within:ring-offset-2")}>
          <ImagePlus size={18} aria-hidden />
          {t("photos.add")}
          {/* No `capture`: a phone offers both the camera and its photo library. */}
          <TextInput type="file" accept="image/*" multiple className="sr-only" disabled={busy > 0}
            onChange={(event) => { const files = [...(event.target.files ?? [])]; event.target.value = ""; if (files.length) void add(files); }} />
        </label>
        <p className="flex items-center gap-2 text-meta text-text-secondary" role="status">
          {(busy > 0 || !library) && <StatusDot kind={busy > 0 ? "progress" : "wait"} />}
          {busy > 0 ? tc("photos.uploading", busy) : library ? t("photos.count", { count: photos.length, max: MAX_PHOTOS }) : t("ui.loading")}
        </p>
      </div>
      <p className="text-meta text-text-secondary">{t("photos.hint")}</p>
      <p className="text-meta text-text-secondary">{t("photos.people")}</p>
      {library && !photos.length ? (
        <EmptyState icon={<Images size={22} />} title={t("photos.empty")} text={t("photos.empty.text")} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3" aria-label={t("photos.title")}>
          {photos.map((photo) => <PhotoCard key={photo.id} photo={photo} campaigns={campaigns} />)}
        </ul>
      )}
    </div>
  );
}

function PhotoCard({ photo, campaigns }: { photo: MediaSummary; campaigns: boolean }) {
  const [alt, setAlt] = useState(photo.altText ?? "");
  const labelId = useId();
  const save = async () => {
    if (alt.trim() === (photo.altText ?? "")) return;
    showToast(t((await describePicture(photo.id, alt)) ? "photos.alt.saved" : "photos.error.failed"));
  };
  const remove = async () => {
    if (!(await deletePicture(photo.id))) return showToast(t("photos.error.failed"));
    showToast(t("photos.deleted"), { label: t("common.undo"), run: () => void restorePicture(photo.id).then((ok) => { if (!ok) showToast(t("photos.error.restore")); }) });
  };
  return (
    <li>
      <Card className="flex h-full flex-col overflow-hidden" aria-labelledby={labelId}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the owner's own picture, served by the app after its session check */}
        <img src={photo.url} alt={photo.altText ?? ""} width={photo.width} height={photo.height} loading="lazy" className="aspect-square w-full bg-surface-2 object-cover" />
        <div className="flex flex-1 flex-col gap-3 p-3">
          <p id={labelId} className="sr-only">{photo.altText || t("photos.noDescription")}</p>
          <Field label={t("photos.alt")} hint={t("photos.alt.hint")}>
            <TextInput value={alt} maxLength={300} onChange={(event) => setAlt(event.target.value)} onBlur={() => void save()} />
          </Field>
          <div className="mt-auto flex flex-wrap gap-2">
            {campaigns && <ButtonLink href={`/studio/more/campaigns/new?photo=${photo.id}`} variant="secondary" size="sm" icon={<Megaphone size={16} />}>{t("photos.useInCampaign")}</ButtonLink>}
            <Button variant="ghost" size="sm" icon={<Trash2 size={16} />} onClick={() => void remove()} aria-label={t("photos.delete.named", { name: photo.altText || t("photos.noDescription") })}>
              {t("photos.delete")}
            </Button>
          </div>
        </div>
      </Card>
    </li>
  );
}
