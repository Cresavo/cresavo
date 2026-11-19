import { Plus, X } from "lucide-react";
import { t } from "../../i18n";
import type { Treatment } from "../../onboarding/salon";
import { DURATION_STEP, MAX_DURATION, MAX_NAME, MAX_PRICE, MIN_DURATION } from "../../services/edit";
import { Button, IconButton } from "../../ui/button";
import { Card } from "../../ui/card";
import { Field, TextInput } from "../../ui/controls";

export function SetupTreatments({ list, currency, change }: { list: Treatment[]; currency: string; change: (next: Treatment[]) => void }) {
  function edit(index: number, patch: Partial<Treatment>) {
    change(list.map((item, i) => index === i ? { ...item, ...patch } : item));
  }
  return <div className="space-y-3">
    {list.map((item, i) => {
      const label = t("setup.treatment", { number: i + 1 });
      return <Card key={i} className="space-y-2 p-4" role="group" aria-label={label}>
        <div className="flex items-end gap-1">
          <div className="min-w-0 flex-1"><Field label={label}><TextInput required maxLength={MAX_NAME} value={item.name} onChange={e => edit(i, { name: e.target.value })} /></Field></div>
          <IconButton label={t("setup.remove", { name: item.name || label })} onClick={() => change(list.filter((_, n) => n !== i))}><X size={18} /></IconButton>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("setup.price", { currency })}><TextInput type="number" required min={0} max={MAX_PRICE} value={Number.isFinite(item.price) ? item.price : ""} onChange={e => edit(i, { price: e.target.valueAsNumber })} /></Field>
          <Field label={t("services.duration")}><TextInput type="number" required min={MIN_DURATION} max={MAX_DURATION} step={DURATION_STEP} value={Number.isFinite(item.duration) ? item.duration : ""} onChange={e => edit(i, { duration: e.target.valueAsNumber })} /></Field>
        </div>
      </Card>;
    })}
    <Button variant="secondary" icon={<Plus size={16} />} onClick={() => change([...list, { name: "", price: 0, duration: 30 }])}>{t("services.add")}</Button>
  </div>;
}
