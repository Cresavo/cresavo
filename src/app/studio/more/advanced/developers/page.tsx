"use client";

import { PUBLIC_DEMO } from "@/concept/ai/api-client";
import { t } from "@/concept/i18n";
import { AiSection } from "@/concept/studio/more/ai-section";
import { ConnectSection, ProtocolList, useProtocolInfo } from "@/concept/studio/more/connect-section";
import { OwnKeyForm } from "@/concept/studio/more/own-key-form";
import { ConnectCard } from "@/concept/studio/pairing/connect-card";
import { usePairing } from "@/concept/studio/pairing/session";
import { AdvancedSubPage } from "@/concept/studio/settings/settings-page";
import { useStudio } from "@/concept/studio/use-studio";
import { Card, Section } from "@/concept/ui/card";

/** The developer side of "Your data": connecting an outside assistant, AI models and costs, own keys and the open protocols. */
export default function DevelopersPage() {
  const pairing = usePairing();
  const { state } = useStudio();
  const { info, failed } = useProtocolInfo();
  return (
    <AdvancedSubPage title={t("advanced.developers")} subtitle={t("advanced.developers.description")}>
      <ConnectCard />
      <div className="space-y-8 lg:max-w-4xl">
        {/* The public demo's server only reads: no outside assistant can connect, so the setup steps would lead nowhere. */}
        {(state.industry || !pairing || !PUBLIC_DEMO) && <div id="connect" data-help-id="developers.connect"><Section title={t("data.connect")}>
          {state.industry ? <Card className="p-5 text-body text-text-secondary">{t("setup.assistantHint")}</Card>
            : PUBLIC_DEMO ? <Card className="p-5 text-body text-text-secondary">{t("data.publicDemo")}</Card>
            : <ConnectSection info={info} failed={failed} />}
        </Section></div>}
        <Section title={t("data.ai")}>
          {state.industry ? <Card className="p-5">{t("ai.localRules")}</Card> : <AiSection />}
        </Section>
        {!state.industry && !PUBLIC_DEMO && (
          <Section title={t("ai.ownKeySection")}>
            <OwnKeyForm />
          </Section>
        )}
        <Section title={t("data.developers")}>
          <p className="text-sm text-text-secondary">{t("data.developersText")}</p>
          <ProtocolList info={info} />
        </Section>
      </div>
    </AdvancedSubPage>
  );
}
