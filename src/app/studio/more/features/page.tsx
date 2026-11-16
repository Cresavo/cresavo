"use client";

import type { ModuleKey } from "@/concept/data/types";
import { t, type MessageKey } from "@/concept/i18n";
import { dispatch } from "@/concept/store";
import { MorePage } from "@/concept/studio/more/more-page";
import { useStudio } from "@/concept/studio/use-studio";
import { Card } from "@/concept/ui/card";
import { Switch } from "@/concept/ui/controls";
import { showToast } from "@/concept/ui/toast";

const MODULES: { key: ModuleKey; label: MessageKey; description: MessageKey }[] = [
  { key: "journal", label: "features.journal", description: "features.journal.description" },
  { key: "stock", label: "features.stock", description: "features.stock.description" },
  { key: "campaigns", label: "features.campaigns", description: "features.campaigns.description" },
  { key: "finance", label: "features.finance", description: "features.finance.description" },
  { key: "reviews", label: "features.reviews", description: "features.reviews.description" },
];

export default function FeaturesPage() {
  const { state } = useStudio();
  return (
    <MorePage title={t("nav.features")} subtitle={t("features.subtitle")}>
      <Card className="divide-y divide-eko-line overflow-hidden">
        {MODULES.map((m) => (
          <div key={m.key} className="flex items-center gap-4 px-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t(m.label)}</p>
              <p className="text-sm text-eko-muted">{t(m.description)}</p>
            </div>
            <Switch
              checked={state.modules[m.key]}
              label={t(m.label)}
              onChange={() => {
                dispatch({ type: "module/toggle", key: m.key });
                showToast(t(state.modules[m.key] ? "features.turnedOff" : "features.turnedOn", { name: t(m.label) }));
              }}
            />
          </div>
        ))}
      </Card>
      <p className="mt-4 text-sm text-eko-muted">{t("features.hint")}</p>
    </MorePage>
  );
}
