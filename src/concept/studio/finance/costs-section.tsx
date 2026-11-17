"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { COST_KINDS, costsByKind, recentResults, totalCosts } from "../../finance/profit";
import type { CostKind } from "../../finance/types";
import { t } from "../../i18n";
import { formatMoney, formatMonth, formatNumber } from "../../i18n/format";
import { dispatch } from "../../store";
import { Badge } from "../../ui/badge";
import { Button, IconButton } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { ColumnChart } from "../../ui/charts";
import { Field, Select, TextInput } from "../../ui/controls";
import { useStudio } from "../use-studio";

const MONTHS_SHOWN = 6;

/** What is left of the month: revenue minus the costs the owner has entered. */
export function CostsSection() {
  const { state, today, minutes } = useStudio();
  const results = recentResults(state, { today, minutes }, MONTHS_SHOWN);
  const last = results[results.length - 1];
  const margin = last.revenue ? last.profit / last.revenue : 0;

  return (
    <Section title={t("finance.costs")}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <div>
            <p className="text-sm text-eko-muted">{t("finance.profitIn", { month: formatMonth(last.month) })}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(last.profit)}</p>
            <p className="mt-1 text-sm text-eko-muted">{t("finance.profitNote", { revenue: formatMoney(last.revenue), costs: formatMoney(last.costs), margin: t("format.percent", { value: formatNumber(margin * 100) }) })}</p>
          </div>
          <ColumnChart
            label={t("finance.profitPerMonth")}
            format={(value) => t("money", { amount: `${formatNumber(value / 1000)}k` })}
            data={results.map((r, i) => ({ label: formatMonth(r.month, true), value: r.profit, highlight: i === results.length - 1 }))}
          />
          <p className="text-xs text-eko-muted">{t("finance.profitHint")}</p>
        </Card>
        <Card className="space-y-4 p-5">
          <ul className="divide-y divide-eko-line">
            {state.costs.map((cost) => (
              <li key={cost.id} className="flex items-center gap-3 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{cost.label}</span>
                  <Badge className="mt-0.5">{t(`finance.kind.${cost.kind}`)}</Badge>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">{formatMoney(cost.amount)}</span>
                <IconButton label={t("finance.removeCost", { name: cost.label })} onClick={() => dispatch({ type: "cost/remove", id: cost.id })}>
                  <X size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-eko-line pt-3 text-sm">
            <span className="text-eko-muted">{t("finance.costsPerMonth")}</span>
            <span className="font-semibold tabular-nums">{formatMoney(totalCosts(state.costs))}</span>
          </div>
          {costsByKind(state.costs).length > 1 && (
            <p className="text-xs text-eko-muted">{costsByKind(state.costs).map((row) => `${t(`finance.kind.${row.kind}`)} ${formatMoney(row.amount)}`).join(" · ")}</p>
          )}
          <AddCost />
        </Card>
      </div>
    </Section>
  );
}

function AddCost() {
  const [kind, setKind] = useState<CostKind>("rent");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const added = dispatch({ type: "cost/add", kind, label: label || t(`finance.kind.${kind}`), amount: Number(amount) });
    if (added) {
      setLabel("");
      setAmount("");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-eko-line pt-4">
      <p className="text-sm font-medium">{t("finance.addCost")}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("finance.costType")}>
          <Select value={kind} onChange={(e) => setKind(e.target.value as CostKind)}>
            {COST_KINDS.map((k) => (
              <option key={k} value={k}>{t(`finance.kind.${k}`)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("finance.costAmount")}>
          <TextInput inputMode="numeric" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
      </div>
      <Field label={t("finance.costLabel")}>
        <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t(`finance.kind.${kind}`)} />
      </Field>
      <Button type="submit" variant="secondary" icon={<Plus size={16} />} disabled={!(Number(amount) > 0)}>
        {t("finance.addCostButton")}
      </Button>
    </form>
  );
}
