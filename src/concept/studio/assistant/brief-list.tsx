import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Brief } from "../../assistant/briefs";
import { t } from "../../i18n";
import { cx } from "../../ui/cx";

/** The items of a brief, most important first. Items with a page link to it. `inset` pads the rows for a list that fills its card edge to edge. */
export function BriefList({ brief, inset }: { brief: Brief; inset?: boolean }) {
  const pad = inset ? "px-4" : "";
  if (!brief.items.length) return <p className={cx("py-3 text-sm text-text-secondary", pad)}>{t("assistant.brief.quiet")}</p>;
  return (
    <ul className="divide-y divide-hairline">
      {brief.items.map((item) => {
        const body = (
          <>
            <span className="min-w-0 flex-1">{item.text}</span>
            {item.href && <ChevronRight size={16} aria-hidden className="shrink-0 text-text-secondary" />}
          </>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href} className={cx("flex min-h-11 items-center gap-3 py-2 text-[15px] hover:bg-surface-2", pad)}>{body}</Link>
            ) : (
              <p className={cx("flex min-h-11 items-center gap-3 py-2 text-[15px]", pad)}>{body}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
