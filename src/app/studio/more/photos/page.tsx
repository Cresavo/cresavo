"use client";

import { t } from "@/concept/i18n";
import { MorePage } from "@/concept/studio/more/more-page";
import { PhotoLibrary } from "@/concept/studio/photos/photo-library";

export default function PhotosPage() {
  return (
    // Reached from Campaigns and the poster's photo choice; More keeps its short list.
    <MorePage title={t("photos.title")} subtitle={t("photos.subtitle")} parent={{ href: "/studio/more/campaigns", label: t("nav.campaigns") }}>
      <PhotoLibrary />
    </MorePage>
  );
}
