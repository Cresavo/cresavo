"use client";

import { useState } from "react";
import { t } from "../../i18n";
import { Tabs } from "../../ui/navigation";
import { MorePage } from "../more/more-page";
import { MemoryPanel } from "./memory-page";
import { RoutinesPanel } from "./routines-page";

export type AssistantTab = "memory" | "routines";

/**
 * The assistant's own page: what it remembers and its routines, as two tabs. Only there while the
 * assistant add-on is on; /studio/more/memory and /studio/more/routines open the matching tab.
 */
export function AssistantPage({ tab: initial = "memory" }: { tab?: AssistantTab }) {
  const [tab, setTab] = useState<AssistantTab>(initial);
  return (
    <MorePage title={t("nav.assistant")} subtitle={t("nav.assistant.description")} module="assistant">
      <Tabs
        label={t("nav.assistant")}
        value={tab}
        onChange={(id) => setTab(id as AssistantTab)}
        tabs={[
          { id: "memory", label: t("nav.memory"), panel: <MemoryPanel /> },
          { id: "routines", label: t("nav.routines"), panel: <RoutinesPanel /> },
        ]}
      />
    </MorePage>
  );
}
