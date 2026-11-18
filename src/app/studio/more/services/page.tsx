"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Service } from "@/concept/data/types";
import { t } from "@/concept/i18n";
import { formatDuration, formatMoney } from "@/concept/i18n/format";
import { packOf } from "@/concept/packs";
import { dispatch, undo } from "@/concept/store";
import { MorePage } from "@/concept/studio/more/more-page";
import { StaffDot } from "@/concept/studio/staff-dot";
import { useStudio } from "@/concept/studio/use-studio";
import { Button } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { Field, TextInput } from "@/concept/ui/controls";
import { Sheet } from "@/concept/ui/sheet";
import { showToast } from "@/concept/ui/toast";

export default function ServicesPage() {
  const { state } = useStudio();
  const [editing, setEditing] = useState<Service | null>(null);
  const [price, setPrice] = useState("");

  const save = () => {
    if (!editing) return;
    dispatch({ type: "service/price", id: editing.id, price: Number(price) });
    showToast(t("services.priceSaved", { name: editing.name, price: formatMoney(Number(price)) }), { label: t("common.undo"), run: undo });
    setEditing(null);
  };

  return (
    <MorePage title={t("nav.services")} subtitle={t("services.subtitle", { count: state.services.length })}>
      <div className="space-y-6">
        {packOf(state).categories.map((category) => (
          <Section key={category} title={t(`category.${category}`)}>
            <Card className="divide-y divide-hairline overflow-hidden">
              {state.services.filter((s) => s.category === category).map((s) => (
                <div key={s.id} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-text-secondary">{s.description}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary">
                      <StaffDot staffId={s.staffIds[0]} />
                      {state.staff.find((p) => p.id === s.staffIds[0])?.firstName} · {formatDuration(s.duration)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{formatMoney(s.price)}</span>
                  <Button variant="ghost" size="sm" className="shrink-0" aria-label={t("services.editPrice")} onClick={() => { setEditing(s); setPrice(String(s.price)); }}>
                    <Pencil size={16} />
                  </Button>
                </div>
              ))}
            </Card>
          </Section>
        ))}
      </div>
      {editing && (
        <Sheet
          open
          onClose={() => setEditing(null)}
          title={t("services.editPrice")}
          description={editing.name}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
              <Button disabled={!(Number(price) > 0)} onClick={save}>{t("common.save")}</Button>
            </>
          }
        >
          <Field label={t("services.price")} hint={t("services.priceHint")}>
            <TextInput type="number" inputMode="numeric" min={0} step={5} value={price} onChange={(e) => setPrice(e.target.value)} autoFocus />
          </Field>
        </Sheet>
      )}
    </MorePage>
  );
}
