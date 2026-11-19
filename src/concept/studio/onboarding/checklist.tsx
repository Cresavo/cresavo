import Link from "next/link";
import { Check, Circle, FileSpreadsheet, X } from "lucide-react";
import { bookingHome } from "../../booking/links";
import { t } from "../../i18n";
import { checklistProgress } from "../../onboarding/salon";
import { dispatch } from "../../store";
import { IconButton } from "../../ui/button";
import { Card } from "../../ui/card";
import { useStudio } from "../use-studio";

export function FirstSteps() {
  const { state } = useStudio();
  if (state.dismissedCards.includes("first-steps")) return null;
  const progress = checklistProgress(state);
  const rows = [
    ["addServices", "/studio/more/services"], ["setHours", "/studio/more/settings#hours"],
    ["share", "/studio/more/settings#share"], ["first", bookingHome(state.salon.slug) + "#book"],
    ["connect", "/studio/more/data#connect"],
  ] as const;
  const done = rows.filter(([key]) => key !== "connect" && progress[key]).length;
  return <Card className="mb-5 p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3"><div>
      <h2 className="text-xl font-semibold tracking-tight">{t("setup.checklist")}</h2>
      <p className="mt-1 text-sm text-text-secondary">{t("setup.progress", { done, total: 4 })}</p>
    </div><IconButton label={t("setup.hide")} onClick={() => dispatch({ type: "card/dismiss", id: "first-steps" })}><X size={18} /></IconButton></div>
    <ul className="mt-3 divide-y divide-hairline">{rows.map(([key, href]) => <li key={key}>
      <Link href={href} className="flex min-h-11 items-center gap-3 rounded-sm text-sm font-medium hover:underline">
        {progress[key] ? <><Check size={18} className="text-action" /><span className="sr-only">{t("setup.done")} </span></> : <Circle size={18} className="text-text-secondary" />}
        {t(`setup.${key}`)}
      </Link></li>)}
      <li><Link href="/studio/more/data#migration" className="flex min-h-11 items-center gap-3 rounded-sm text-sm font-medium hover:underline">
        <FileSpreadsheet aria-hidden size={18} className="text-text-secondary" />{t("setup.migration")}
      </Link></li>
    </ul>
  </Card>;
}
