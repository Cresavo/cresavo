"use client";

import { ChevronRight, Download, MessageCircle, ShieldCheck, Upload } from "lucide-react";
import { t } from "@/concept/i18n";
import { bookingsCsv, customersCsv, download } from "@/concept/studio/more/export";
import { MorePage } from "@/concept/studio/more/more-page";
import { DEVELOPERS_PAGE } from "@/concept/studio/nav";
import { ConnectCard } from "@/concept/studio/pairing/connect-card";
import { usePairing } from "@/concept/studio/pairing/session";
import { dispatch, useDemo } from "@/concept/store";
import { useStudio } from "@/concept/studio/use-studio";
import { dispatchWithUndoToast } from "@/concept/studio/log/undo-toast";
import { Button, ButtonLink } from "@/concept/ui/button";
import { Card } from "@/concept/ui/card";
import type { ReactNode } from "react";

function PlainCard({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1 shrink-0 text-text-secondary">{icon}</span>
        <div className="min-w-0 space-y-1">
          <h2 className="text-h3 font-semibold">{title}</h2>
          <p className="text-body text-text-secondary">{text}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

/** Your data, in three plain cards. The developer details (assistants, models, keys, protocols) are under Advanced. */
export default function DataPage() {
  const { state, today } = useStudio();
  const pairing = usePairing();
  const saved = useDemo() ?? state;
  const exports = [
    { label: t("data.export.all"), run: () => {
      download(`${state.salon.slug}-${today}.json`, JSON.stringify(saved, null, 2), "application/json");
      // The file holds every journal: that is a read of all of them.
      if (saved.journals.length) dispatch({ type: "journal/view", actor: "owner" });
    } },
    { label: t("data.export.customers"), run: () => download(`${state.salon.slug}-customers-${today}.csv`, customersCsv(saved), "text/csv") },
    { label: t("data.export.bookings"), run: () => download(`${state.salon.slug}-bookings-${today}.csv`, bookingsCsv(saved), "text/csv") },
  ];

  return (
    <MorePage title={t("nav.data")} subtitle={t("data.subtitle")}>
      <ConnectCard />
      <div className="grid grid-cols-1 gap-4 lg:max-w-5xl lg:grid-cols-3">
        <div id="migration" className="contents">
          <PlainCard icon={<Download size={22} />} title={t("data.card.download")} text={t("data.card.downloadText")}>
            <div className="flex flex-wrap gap-2">
              {exports.map(({ label, run }, index) => (
                <Button key={label} size="sm" variant={!pairing && index === 0 ? "primary" : "secondary"} icon={<Download size={16} />} onClick={run}>{label}</Button>
              ))}
            </div>
          </PlainCard>
          <PlainCard icon={<Upload size={22} />} title={t("data.card.import")} text={t("data.card.importText")}>
            <ButtonLink href="/studio/customers/import" variant="secondary" size="sm" className="self-start">{t("import.title")}</ButtonLink>
          </PlainCard>
        </div>
        <PlainCard icon={<ShieldCheck size={22} />} title={t("data.card.privacy")} text={t("data.card.privacyText")}>
          <ButtonLink href="/studio/more/privacy" variant="secondary" size="sm" className="self-start">{t("data.card.privacyOpen")}</ButtonLink>
        </PlainCard>
        <PlainCard icon={<MessageCircle size={22} />} title={t("data.card.assistant")} text={t("data.card.assistantText")}>
          <div className="flex flex-wrap gap-2">
            {state.industry && (
              <Button size="sm" variant="secondary" disabled={state.modules.assistant} onClick={() => dispatchWithUndoToast({ type: "module/toggle", key: "assistant" }, t("setup.assistantReady"))}>
                {t(state.modules.assistant ? "setup.assistantReady" : "setup.enableAssistant")}
              </Button>
            )}
            <ButtonLink href={DEVELOPERS_PAGE} variant="tertiary" size="sm" icon={<ChevronRight size={16} />}>{t("data.card.assistantDetails")}</ButtonLink>
          </div>
        </PlainCard>
      </div>
    </MorePage>
  );
}
