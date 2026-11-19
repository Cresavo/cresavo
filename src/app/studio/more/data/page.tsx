"use client";

import { usePairing } from "@/concept/studio/pairing/session";
import { ConnectCard } from "@/concept/studio/pairing/connect-card";

import { ChevronRight, Download } from "lucide-react";
import { t } from "@/concept/i18n";
import { bookingsCsv, customersCsv, download } from "@/concept/studio/more/export";
import { PUBLIC_DEMO } from "@/concept/ai/api-client";
import { AiSection } from "@/concept/studio/more/ai-section";
import { ConnectSection, ProtocolList, useProtocolInfo } from "@/concept/studio/more/connect-section";
import { MorePage } from "@/concept/studio/more/more-page";
import { OwnKeyForm } from "@/concept/studio/more/own-key-form";
import { useDemo } from "@/concept/store";
import { useStudio } from "@/concept/studio/use-studio";
import { dispatchWithUndoToast } from "@/concept/studio/log/undo-toast";
import { Button, ButtonLink } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";

export default function DataPage() {
  const pairing = usePairing();
  const { state, today } = useStudio();
  const saved = useDemo() ?? state;
  const { info, failed } = useProtocolInfo();
  const exports = [
    { label: t("data.export.all"), description: t("data.export.allContents"), run: () => download(`${state.salon.slug}-${today}.json`, JSON.stringify(saved, null, 2), "application/json") },
    { label: t("data.export.customers"), description: t("data.export.customerContents"), run: () => download(`${state.salon.slug}-customers-${today}.csv`, customersCsv(saved), "text/csv") },
    { label: t("data.export.bookings"), description: t("data.export.bookingContents"), run: () => download(`${state.salon.slug}-bookings-${today}.csv`, bookingsCsv(saved), "text/csv") },
  ];

  return (
    <MorePage title={t("nav.data")} subtitle={t("data.subtitle")}>
      <ConnectCard />
      {/* What an owner comes here for first: getting the data out, and letting an assistant in. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <div id="migration" className="scroll-mt-4">
          <Section title={t("data.migration.title")}>
            <Card className="space-y-4 p-5">
              <p className="text-sm text-text-secondary">{t("data.exportText")}</p>
              <ol className="list-decimal space-y-4 pl-5 text-sm marker:font-semibold">
                <li className="space-y-2 pl-1">
                  <h3 className="font-semibold">{t("data.migration.download")}</h3>
                  <ul className="divide-y divide-hairline">
                    {exports.map(({ label, description, run }) => (
                      <li key={label} className="space-y-1 py-2">
                        <Button variant="secondary" icon={<Download size={16} />} onClick={run}>{label}</Button>
                        <p className="text-text-secondary">{description}</p>
                      </li>
                    ))}
                  </ul>
                </li>
                <li className="space-y-2 pl-1">
                  <h3 className="font-semibold">{t("data.migration.prepare")}</h3>
                  <p className="text-text-secondary">{t("data.migration.prepareText")}</p>
                </li>
                <li className="space-y-2 pl-1">
                  <h3 className="font-semibold">{t("data.migration.import")}</h3>
                  <p className="text-text-secondary">{t("data.migration.importText")}</p>
                  <p className="text-text-secondary">{t("data.migration.limit")}</p>
                  <ButtonLink href="/studio/customers/import" variant="secondary">{t("import.title")}</ButtonLink>
                </li>
              </ol>
            </Card>
          </Section>
        </div>
        {(state.industry || !pairing || !PUBLIC_DEMO) && <div id="connect"><Section title={t("data.connect")}>
          {/* The public demo's server only reads: no outside assistant can connect, so the setup steps would lead nowhere. */}
          {state.industry ? <Card className="space-y-3 p-5">
            <p>{t("setup.assistantHint")}</p>
            <Button variant="secondary" disabled={state.modules.assistant} onClick={() => dispatchWithUndoToast({ type: "module/toggle", key: "assistant" }, t("setup.assistantReady"))}>
              {t(state.modules.assistant ? "setup.assistantReady" : "setup.enableAssistant")}
            </Button>
          </Card> : PUBLIC_DEMO ? <Card className="p-5 text-[15px] text-text-secondary">{t("data.publicDemo")}</Card> : <ConnectSection info={info} failed={failed} />}
        </Section></div>}
      </div>
      <div className="mt-8 space-y-8">
        <Section title={t("data.ai")}>
          {state.industry ? <Card className="p-5">{t("ai.localRules")}</Card> : <AiSection />}
        </Section>
        {!state.industry && !PUBLIC_DEMO && (
          <Section title={t("ai.ownKeySection")}>
            <OwnKeyForm />
          </Section>
        )}
        {/* The protocol table is for whoever builds an integration, not for running the salon: folded away at the end. */}
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[17px] font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
            <ChevronRight aria-hidden size={18} className="text-text-secondary transition-transform group-open:rotate-90" />
            {t("data.developers")}
          </summary>
          <div className="mt-3 space-y-3 lg:max-w-3xl">
            <p className="text-sm text-text-secondary">{t("data.developersText")}</p>
            <ProtocolList info={info} />
          </div>
        </details>
      </div>
    </MorePage>
  );
}
