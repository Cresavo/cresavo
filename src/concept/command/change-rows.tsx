import { ArrowRight } from "lucide-react";
import { t } from "../i18n";
import type { ChangeRow } from "./proposal";

/** What a proposed change does, row by row: before (struck through) and after. */
export function ChangeRows({ rows }: { rows: ChangeRow[] }) {
  return (
    <dl className="divide-y divide-border rounded-md bg-surface-2/60 px-3.5">
      {rows.map((row) => (
        <div key={row.label} className="space-y-0.5 py-2.5 text-sm">
          <dt className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{row.label}</dt>
          <dd className="flex flex-wrap items-center gap-x-2">
            {row.before && (
              <>
                <span className="text-text-secondary line-through">{row.before}</span>
                <ArrowRight size={14} className="text-text-secondary" aria-label={t("command.becomes")} />
              </>
            )}
            <span className="font-medium">{row.after}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
