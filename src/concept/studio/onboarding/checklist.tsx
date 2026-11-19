import Link from "next/link";
import { Check, Circle, X } from "lucide-react";
import { bookingHome } from "../../booking/links";
import { t } from "../../i18n";
import { CHECKLIST_ROWS, checklistProgress, pageSeenCard, type ChecklistRow } from "../../onboarding/salon";
import { dispatch } from "../../store";
import { IconButton } from "../../ui/button";
import { useStudio } from "../use-studio";

const DISMISSED = "first-steps";

/** Opening the booking page from the studio counts as having checked it. */
export function recordPageSeen(slug: string) {
  dispatch({ type: "card/dismiss", id: pageSeenCard(slug) });
}

/** Getting started as one thin, dismissible strip under the day's heading. */
export function FirstSteps() {
  const { state } = useStudio();
  if (state.dismissedCards.includes(DISMISSED)) return null;
  const progress = checklistProgress(state);
  const slug = state.salon.slug;
  const href: Record<ChecklistRow, string> = {
    addServices: "/studio/more/services",
    bookingPage: bookingHome(slug),
    share: "/studio/more/settings/link",
    testBooking: bookingHome(slug) + "#book",
  };
  const done = CHECKLIST_ROWS.filter(row => progress[row]).length;
  return <section aria-labelledby="first-steps" className="mb-5 flex items-start gap-2 rounded-md bg-surface-2 py-1 pl-4 pr-1">
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4">
      <h2 id="first-steps" className="py-3 text-meta font-semibold">
        {t("setup.checklist")} · <span className="font-normal text-text-secondary">{t("setup.progress", { done, total: CHECKLIST_ROWS.length })}</span>
      </h2>
      <ul className="flex flex-wrap gap-x-4">{CHECKLIST_ROWS.map(row => <li key={row}>
        <Link href={href[row]} onClick={row === "bookingPage" ? () => recordPageSeen(slug) : undefined}
          className="flex min-h-target items-center gap-1.5 text-meta font-medium hover:underline">
          {progress[row] ? <><Check aria-hidden size={16} className="text-action" /><span className="sr-only">{t("setup.done")} </span></>
            : <Circle aria-hidden size={16} className="text-text-secondary" />}
          <span className={progress[row] ? "text-text-secondary line-through" : undefined}>{t(`setup.${row}`)}</span>
        </Link></li>)}
      </ul>
    </div>
    <IconButton label={t("setup.hide")} onClick={() => dispatch({ type: "card/dismiss", id: DISMISSED })}><X size={18} /></IconButton>
  </section>;
}
