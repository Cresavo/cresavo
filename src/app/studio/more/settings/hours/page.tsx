"use client";

import { t } from "@/concept/i18n";
import { ClosedDaysSection } from "@/concept/studio/ops/closed-days";
import { HoursSection } from "@/concept/studio/ops/hours-section";
import { SettingsSubPage } from "@/concept/studio/settings/settings-page";

export default function HoursSettingsPage() {
  return (
    <SettingsSubPage title={t("settings.section.hours")} subtitle={t("settings.section.hours.description")}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div id="hours" data-help-id="hours.weekly"><HoursSection /></div>
        <ClosedDaysSection />
      </div>
    </SettingsSubPage>
  );
}
