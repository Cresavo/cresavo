"use client";

import { t } from "../../i18n";
import { useActiveWorkspace } from "../../store";
import { SkeletonCard } from "../../ui/feedback";
import { FriendlyNotice, friendlyMessage } from "../../ui/friendly-message";
import { useSalonNow } from "../../use-now";
import { MorePage } from "../more/more-page";
import { useStudio } from "../use-studio";
import { CallList } from "./call-list";
import { SettingsSection } from "./settings-section";
import { TestCallSection } from "./test-call-section";
import { useReceptionistStatus } from "./use-receptionist-status";

/** Why the page has nothing to set up here, said calmly with what to do instead. */
function Missing({ reason }: { reason: "off" | "own" | "unknown" }) {
  return <FriendlyNotice className="md:max-w-form" message={friendlyMessage({ what: `receptionist.missing.${reason}.what`, next: `receptionist.missing.${reason}.next` })} />;
}

/** The phone receptionist: switch it on, word the greeting, try a call in the browser and read what was said. */
export function ReceptionistPage() {
  const { state } = useStudio();
  const now = useSalonNow();
  const status = useReceptionistStatus();
  const workspace = useActiveWorkspace();
  return (
    <MorePage title={t("nav.receptionist")} subtitle={t("receptionist.subtitle")}>
      {status === "loading" ? <SkeletonCard lines={3} className="md:max-w-form" />
        : status === "unknown" ? <Missing reason="unknown" />
        : !status.enabled ? <Missing reason="off" />
        : workspace !== "demo" ? <Missing reason="own" />
        : (
          <div className="space-y-8 md:max-w-form">
            <SettingsSection state={state} today={now.today} minutes={now.minutes} />
            <TestCallSection state={state} limits={status.limits} configured={status.configured} />
            <CallList state={state} />
          </div>
        )}
    </MorePage>
  );
}
