import { useState } from "react";
import type { Locale } from "@/lib/locale";
import { Check, Pencil, Plus, X } from "lucide-react";
import { t } from "../../i18n";
import { formatDuration, formatMoney } from "../../i18n/format";
import { treatmentIssue, type Treatment } from "../../onboarding/salon";
import { DURATION_STEP, MAX_DURATION, MAX_NAME, MAX_PRICE, MIN_DURATION } from "../../services/edit";
import { Button, IconButton } from "../../ui/button";
import { Card } from "../../ui/card";
import { Field, TextInput } from "../../ui/controls";

interface Props {
  list: Treatment[];
  currency: string;
  language: Locale;
  change: (next: Treatment[]) => void;
}

/**
 * The suggested price list as plain rows. Edit opens one row in place; a new treatment opens
 * straight away. The list is never longer than the screen needs.
 */
export function SetupTreatments({ list, currency, language, change }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  const edit = (index: number, patch: Partial<Treatment>) => change(list.map((item, i) => index === i ? { ...item, ...patch } : item));
  const remove = (index: number) => {
    change(list.filter((_, n) => n !== index));
    setEditing(current => current === null || current === index ? null : current > index ? current - 1 : current);
  };
  return <div className="space-y-3">
    <Card className="divide-y divide-hairline overflow-hidden">
      {list.map((item, i) => {
        const label = item.name.trim() || t("setup.treatment", { number: i + 1 });
        const issue = treatmentIssue(list, i);
        if (editing === i) return <div key={i} role="group" aria-label={label} className="space-y-3 p-4">
          <Field width="short" label={t("setup.treatmentName")} error={issue === "name" ? t("setup.issue.name") : issue === "nameTaken" ? t("services.issue.nameTaken") : undefined}>
            <TextInput required maxLength={MAX_NAME} value={item.name} onChange={e => edit(i, { name: e.target.value })} />
          </Field>
          <div className="grid gap-3 min-[360px]:flex">
            <Field width="number" label={t("setup.price", { currency })} error={issue === "price" ? t("setup.issue.price") : undefined}>
              <TextInput type="number" inputMode="numeric" required min={0} max={MAX_PRICE} value={Number.isFinite(item.price) ? item.price : ""} onChange={e => edit(i, { price: e.target.valueAsNumber })} />
            </Field>
            <Field width="number" label={t("services.duration")} error={issue === "duration" ? t("setup.issue.duration") : undefined}>
              <TextInput type="number" inputMode="numeric" required min={MIN_DURATION} max={MAX_DURATION} step={DURATION_STEP} value={Number.isFinite(item.duration) ? item.duration : ""} onChange={e => edit(i, { duration: e.target.valueAsNumber })} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<Check size={16} />} disabled={!!issue} onClick={() => setEditing(null)}>{t("setup.treatmentDone")}</Button>
            <Button variant="tertiary" size="sm" icon={<X size={16} />} onClick={() => remove(i)}>{t("setup.remove", { name: label })}</Button>
          </div>
        </div>;
        return <div key={i} className="flex min-h-14 items-center gap-1 py-1 pl-4 pr-1">
          <div className="min-w-0 flex-1 break-words">
            <p className="text-body font-medium">{label}</p>
            <p className="text-meta text-text-secondary">{formatDuration(item.duration)} · {formatMoney(item.price, currency, language)}</p>
            {issue && <p className="text-meta text-danger">{t("setup.issue.row")}</p>}
          </div>
          <IconButton label={t("setup.edit", { name: label })} onClick={() => setEditing(i)}><Pencil size={18} /></IconButton>
          <IconButton label={t("setup.remove", { name: label })} onClick={() => remove(i)}><X size={18} /></IconButton>
        </div>;
      })}
    </Card>
    <Button variant="secondary" icon={<Plus size={16} />} onClick={() => {
      change([...list, { name: "", price: 0, duration: 30 }]);
      setEditing(list.length);
    }}>{t("services.add")}</Button>
  </div>;
}
