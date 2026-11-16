import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { t, tc } from "../i18n";
import { formatMoney } from "../i18n/format";
import { Avatar } from "../ui/avatar";
import { BarList } from "../ui/charts";
import type { Proposal } from "./proposal";

type Answer = Extract<Proposal, { kind: "revenue" | "customers" }>;

/** Answers to questions: a number with a small chart, or a list of customers. */
export function AnswerCard({ answer }: { answer: Answer }) {
  if (answer.kind === "revenue") {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-eko-muted">{answer.title}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(answer.total)}</p>
          <p className="text-sm text-eko-muted">
            {answer.range} · {tc("command.revenue.visits", answer.visits)}
          </p>
        </div>
        {answer.bars.length > 0 ? (
          <BarList data={answer.bars.map((bar) => ({ id: bar.id, label: bar.label, value: bar.value }))} format={formatMoney} />
        ) : (
          <p className="text-sm text-eko-muted">{t("command.revenue.none")}</p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold">{answer.title}</p>
        <p className="text-sm text-eko-muted">{tc("command.customers.count", answer.total)}</p>
      </div>
      {answer.items.length > 0 && (
        <ul className="-mx-2 divide-y divide-eko-line">
          {answer.items.map((item) => (
            <li key={item.id}>
              <Link href={`/studio/customers/${item.id}`} className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-eko-sunken">
                <Avatar name={item.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  <span className="block truncate text-xs text-eko-muted">{item.detail}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-eko-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {answer.total > answer.items.length && (
        <p className="text-xs text-eko-muted">{t("command.customers.more", { count: answer.total - answer.items.length })}</p>
      )}
    </div>
  );
}
