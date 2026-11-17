import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Brief } from "../../assistant/briefs";
import { t } from "../../i18n";

/** The items of a brief, most important first. Items with a page link to it. */
export function BriefList({ brief }: { brief: Brief }) {
  if (!brief.items.length) return <p className="text-sm text-eko-muted">{t("assistant.brief.quiet")}</p>;
  return (
    <ul className="-mx-1 divide-y divide-eko-line">
      {brief.items.map((item) => {
        const body = (
          <>
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-eko-accent" aria-hidden />
            <span className="min-w-0 flex-1">{item.text}</span>
            {item.href && <ChevronRight size={16} className="mt-0.5 shrink-0 text-eko-muted" />}
          </>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href} className="flex gap-3 rounded-lg px-1 py-2 text-sm hover:bg-eko-sunken">{body}</Link>
            ) : (
              <p className="flex gap-3 px-1 py-2 text-sm">{body}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
