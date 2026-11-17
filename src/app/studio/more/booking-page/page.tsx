"use client";

import { t } from "@/concept/i18n";
import { MorePage } from "@/concept/studio/more/more-page";
import { PageEditor } from "@/concept/studio/page/editor";
import { useStudio } from "@/concept/studio/use-studio";
import { ButtonLink } from "@/concept/ui/button";

export default function BookingPageEditor() {
  const { state } = useStudio();
  return (
    <MorePage
      title={t("nav.bookingPage")}
      subtitle={t("pageEditor.subtitle")}
      actions={<ButtonLink href={`/boka/${state.salon.slug}`} variant="secondary">{t("pageEditor.open")}</ButtonLink>}
    >
      <PageEditor />
    </MorePage>
  );
}
