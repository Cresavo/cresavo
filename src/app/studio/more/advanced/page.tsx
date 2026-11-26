"use client";

import { ChevronRight, Code2 } from "lucide-react";
import { t } from "@/concept/i18n";
import { EmbedCode } from "@/concept/studio/more/booking-share";
import { MorePage } from "@/concept/studio/more/more-page";
import { DEVELOPERS_PAGE } from "@/concept/studio/nav";
import { SmsPriceSettings } from "@/concept/studio/more/reminder-settings";
import { RoleSwitch } from "@/concept/studio/ops/role-switch";
import { ResourcesSection } from "@/concept/studio/ops/resources-section";
import { OwnAddressSection } from "@/concept/studio/page/address-section";
import { BookingLanguageSection, CustomStylingSection, DemoSection, PackSection } from "@/concept/studio/settings/advanced-sections";
import { LabsSection } from "@/concept/studio/settings/labs-section";
import { SupportAccess } from "@/concept/studio/support/support-access";
import { useStudio } from "@/concept/studio/use-studio";
import { Card, Section } from "@/concept/ui/card";
import { ListRow } from "@/concept/ui/list-row";
import { useSalonNow } from "@/concept/use-now";

/**
 * Everything most salons never need, in one place: developer details, the website code and an own domain,
 * booking language, the SMS price, own styling, rooms, support access, Labs, the industry pack and the demo reset.
 */
export default function AdvancedPage() {
  const { state } = useStudio();
  const salonNow = useSalonNow();
  return (
    <MorePage title={t("nav.advanced")} subtitle={t("advanced.subtitle")} parent={{ href: "/studio/more/settings", label: t("nav.settings") }}>
      <div className="space-y-8 md:max-w-form">
        <Section title={t("advanced.developers")}>
          <Card className="overflow-hidden p-1">
            <ListRow
              href={DEVELOPERS_PAGE}
              helpId="advanced.developers"
              title={t("advanced.developers.open")}
              meta={t("advanced.developers.description")}
              leading={<Code2 size={22} aria-hidden className="shrink-0 text-text-secondary" />}
              trailing={<ChevronRight size={18} aria-hidden className="shrink-0 text-text-secondary" />}
            />
          </Card>
        </Section>
        <div id="website" className="scroll-mt-4 space-y-8">
          <div data-help-id="advanced.embed"><EmbedCode /></div>
          <div data-help-id="advanced.own-domain"><OwnAddressSection /></div>
        </div>
        <div id="language" data-help-id="advanced.booking-language" className="scroll-mt-4"><BookingLanguageSection /></div>
        <div id="sms" data-help-id="advanced.sms-price" className="scroll-mt-4"><SmsPriceSettings key={state.salon.slug} state={state} today={salonNow.today} /></div>
        <div id="styling" data-help-id="advanced.styling" className="scroll-mt-4"><CustomStylingSection key={state.salon.slug} /></div>
        <div id="resources" data-help-id="advanced.rooms" className="scroll-mt-4"><ResourcesSection /></div>
        <div id="support" data-help-id="advanced.support-access" className="scroll-mt-4"><SupportAccess /></div>
        <div id="labs" data-help-id="advanced.labs" className="scroll-mt-4"><LabsSection /></div>
        <div id="pack" data-help-id="advanced.pack" className="scroll-mt-4"><PackSection /></div>
        <RoleSwitch />
        <DemoSection />
      </div>
    </MorePage>
  );
}
