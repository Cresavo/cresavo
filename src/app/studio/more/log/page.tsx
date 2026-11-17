"use client";

import { useState } from "react";
import { t } from "@/concept/i18n";
import { ActivityList } from "@/concept/studio/log/activity-list";
import { TicketsList } from "@/concept/studio/log/tickets-list";
import { TrashList } from "@/concept/studio/log/trash-list";
import { MorePage } from "@/concept/studio/more/more-page";
import { useStudio } from "@/concept/studio/use-studio";
import { Segmented } from "@/concept/ui/controls";

type Tab = "activity" | "trash" | "tickets";

export default function LogPage() {
  const { state } = useStudio();
  const [tab, setTab] = useState<Tab>("activity");
  return (
    <MorePage title={t("nav.log")} subtitle={t("log.subtitle")}>
      <div className="space-y-5">
        <Segmented<Tab>
          label={t("log.tabs")}
          value={tab}
          onChange={setTab}
          className="w-full sm:w-auto"
          options={[
            { value: "activity", label: t("log.tab.activity") },
            { value: "trash", label: `${t("log.tab.trash")}${state.trash.length ? ` (${state.trash.length})` : ""}`, help: "log-tab-trash" },
            { value: "tickets", label: `${t("log.tab.tickets")}${state.tickets.length ? ` (${state.tickets.length})` : ""}` },
          ]}
        />
        {tab === "activity" && <ActivityList />}
        {tab === "trash" && <TrashList />}
        {tab === "tickets" && <TicketsList />}
      </div>
    </MorePage>
  );
}
