"use client";

import { t } from "@/concept/i18n";
import { BookingShare } from "@/concept/studio/more/booking-share";
import { BookingLinkSection } from "@/concept/studio/page/address-section";
import { SettingsSubPage } from "@/concept/studio/settings/settings-page";

export default function BookingLinkPage() {
  return (
    <SettingsSubPage title={t("settings.section.link")} subtitle={t("settings.section.link.description")}>
      <div className="space-y-6 md:max-w-form">
        <div id="share"><BookingShare /></div>
        <div data-help-id="link.address"><BookingLinkSection /></div>
      </div>
    </SettingsSubPage>
  );
}
