"use client";

import { t } from "@/concept/i18n";
import { SalonDetailsForm } from "@/concept/studio/settings/salon-details-form";
import { SettingsSubPage } from "@/concept/studio/settings/settings-page";
import { useStudio } from "@/concept/studio/use-studio";

export default function SalonSettingsPage() {
  const { state } = useStudio();
  return (
    <SettingsSubPage title={t("settings.section.salon")} subtitle={t("settings.section.salon.description")}>
      <SalonDetailsForm key={`${state.industry ?? "demo"}:${state.salon.slug}`} />
    </SettingsSubPage>
  );
}
