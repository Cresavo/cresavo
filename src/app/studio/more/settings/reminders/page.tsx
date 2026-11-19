"use client";

import { t } from "@/concept/i18n";
import { BookingRules } from "@/concept/studio/ops/booking-rules";
import { ReminderSettings } from "@/concept/studio/more/reminder-settings";
import { SettingsSubPage } from "@/concept/studio/settings/settings-page";
import { useStudio } from "@/concept/studio/use-studio";

export default function ReminderSettingsPage() {
  const { state } = useStudio();
  return (
    <SettingsSubPage title={t("settings.section.reminders")} subtitle={t("settings.section.reminders.description")}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ReminderSettings state={state} />
        <BookingRules key={state.cancellationPolicy.version} state={state} />
      </div>
    </SettingsSubPage>
  );
}
