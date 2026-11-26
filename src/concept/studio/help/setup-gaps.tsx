"use client";

import { SETUP_GAP_MESSAGES, setupGaps } from "../../help/setup-gaps";
import { t } from "../../i18n";
import { friendlyMessage, FriendlyNotice } from "../../ui/friendly-message";
import { useStudio } from "../use-studio";

/** What is still missing before customers can book, each with its next step and a "Show me" to the place. */
export function SetupGaps({ onShow }: { onShow: () => void }) {
  const { state } = useStudio();
  const gaps = setupGaps(state);
  if (!gaps.length) return null;
  return (
    <section aria-labelledby="setup-gaps" className="space-y-2">
      <h3 id="setup-gaps" className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{t("setupGaps.title")}</h3>
      <ul className="space-y-2">
        {gaps.map((gap) => (
          <li key={gap}><FriendlyNotice message={friendlyMessage(SETUP_GAP_MESSAGES[gap])} onShowMe={onShow} /></li>
        ))}
      </ul>
    </section>
  );
}
