"use client";

import { useState } from "react";
import type { ModuleKey } from "@/concept/data/types";
import { t } from "@/concept/i18n";
import { MODULES, moduleById, moduleConsent, moduleEnabled } from "@/concept/modules/registry";
import { dispatch } from "@/concept/store";
import { MorePage } from "@/concept/studio/more/more-page";
import { useStudio } from "@/concept/studio/use-studio";
import { Card } from "@/concept/ui/card";
import { ConsentSheet } from "@/concept/ui/consent-sheet";
import { ListRow } from "@/concept/ui/list-row";
import { Switch } from "@/concept/ui/controls";
import { showToast } from "@/concept/ui/toast";

/**
 * Add-ons: a plain list of what can be switched on, each with one line and a switch. No prices or packs here
 * (pack switching is under Advanced). An add-on that takes money from customers asks first, with a ConsentSheet.
 */
export default function AddOnsPage() {
  const { state } = useStudio();
  const [asking, setAsking] = useState<ModuleKey | null>(null);
  const toggle = (key: ModuleKey) => {
    const on = moduleEnabled(state.modules, key);
    if (dispatch({ type: "module/toggle", key })) showToast(t(on ? "features.turnedOff" : "features.turnedOn", { name: t(moduleById(key).name) }));
  };
  const consent = asking ? moduleConsent(asking) : undefined;

  return (
    <MorePage title={t("nav.features")} subtitle={t("features.subtitle")}>
      <div className="max-w-3xl space-y-3">
        <Card className="overflow-hidden">
          <ul className="divide-y divide-hairline">
            {MODULES.map((module) => {
              const on = moduleEnabled(state.modules, module.id);
              return (
                <li key={module.id}>
                  <ListRow title={t(module.name)} meta={t(module.description)} trailing={<Switch
                    checked={on}
                    label={t(module.name)}
                    onChange={() => (!on && moduleConsent(module.id) ? setAsking(module.id) : toggle(module.id))}
                  />} />
                </li>
              );
            })}
          </ul>
        </Card>
        <p className="text-meta text-text-secondary">{t("features.hint")}</p>
      </div>
      {asking && consent && (
        <ConsentSheet
          open
          title={t("addons.consent.title", { name: t(moduleById(asking).name) })}
          summary={t(consent.summary)}
          grants={consent.grants.map((grant) => t(grant))}
          verb={t("addons.consent.verb")}
          onClose={() => setAsking(null)}
          onConfirm={() => {
            setAsking(null);
            toggle(asking);
          }}
        />
      )}
    </MorePage>
  );
}
