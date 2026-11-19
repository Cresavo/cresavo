import { ChevronRight } from "lucide-react";
import type { Brief } from "../../assistant/briefs";
import { t } from "../../i18n";
import { cx } from "../../ui/cx";
import { ListRow } from "../../ui/list-row";

/** The items of a brief, most important first. Items with a page link to it. `inset` pads the rows for a list that fills its card edge to edge. */
export function BriefList({ brief, inset }: { brief: Brief; inset?: boolean }) {
  const pad = inset ? "px-4" : "";
  if (!brief.items.length) return <p className={cx("py-3 text-sm text-text-secondary", pad)}>{t("assistant.brief.quiet")}</p>;
  return (
    <ul className="divide-y divide-hairline">
      {brief.items.map((item) => {
        return (
          <li key={item.id}>
            <ListRow href={item.href} title={item.text} className={inset ? undefined : "!px-0"}
              trailing={item.href && <ChevronRight size={16} aria-hidden className="shrink-0 text-text-secondary" />} />
          </li>
        );
      })}
    </ul>
  );
}
