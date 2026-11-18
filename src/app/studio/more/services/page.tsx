"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Plus } from "lucide-react";
import type { Service } from "@/concept/data/types";
import { t, tc } from "@/concept/i18n";
import { formatDuration, formatMoney } from "@/concept/i18n/format";
import { useRole } from "@/concept/ops/role";
import { dispatch } from "@/concept/store";
import { MorePage } from "@/concept/studio/more/more-page";
import { CategoriesSheet } from "@/concept/studio/services/categories-sheet";
import { DeleteServiceSheet } from "@/concept/studio/services/delete-sheet";
import { ServiceSheet } from "@/concept/studio/services/service-sheet";
import { useStudio } from "@/concept/studio/use-studio";
import { Button, IconButton } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { Notice } from "@/concept/ui/notice";

type Open = { kind: "edit"; id: string } | { kind: "add"; category?: string } | { kind: "delete"; id: string } | { kind: "categories" } | null;

/** The price list: every treatment under its heading, in the order the booking page shows them. */
export default function ServicesPage() {
  const { state, today } = useStudio();
  const canEdit = useRole() === "owner";
  const [open, setOpen] = useState<Open>(null);
  const [reordering, setReordering] = useState(false);
  const hidden = state.services.filter((s) => s.hidden).length;
  const target = open && "id" in open ? state.services.find((s) => s.id === open.id) : undefined;
  const staffNames = (service: Service) => state.staff.filter((p) => service.staffIds.includes(p.id)).map((p) => p.firstName).join(", ");

  return (
    <MorePage
      title={t("nav.services")}
      subtitle={[tc("services.subtitle", state.services.length), hidden ? t("services.subtitleHidden", { count: hidden }) : ""].filter(Boolean).join(" · ")}
      actions={
        canEdit && (
          <>
            <Button variant="ghost" size="sm" aria-pressed={reordering} onClick={() => setReordering((current) => !current)}>{t(reordering ? "services.reorderDone" : "services.reorder")}</Button>
            <Button variant="secondary" size="sm" onClick={() => setOpen({ kind: "categories" })}>{t("services.categories")}</Button>
            <Button size="sm" icon={<Plus size={18} />} onClick={() => setOpen({ kind: "add" })}>{t("services.add")}</Button>
          </>
        )
      }
    >
      {!canEdit && <Notice tone="info" className="mb-5">{t("services.readOnly")}</Notice>}
      <div className="space-y-7">
        {state.categories.map((category) => {
          const services = state.services.filter((s) => s.category === category.id);
          return (
            <Section key={category.id} title={category.name}>
              <Card className="divide-y divide-hairline overflow-hidden">
                {services.map((s, index) => {
                  const text = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {s.name}
                          {s.hidden && <span className="ml-2 text-sm font-normal text-text-secondary">· {t("services.hidden")}</span>}
                        </span>
                        {s.description && <span className="mt-0.5 block text-sm text-text-secondary">{s.description}</span>}
                        <span className="mt-1 block text-sm text-text-secondary">{formatDuration(s.duration)} · {staffNames(s)}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatMoney(s.price)}</span>
                    </>
                  );
                  if (reordering) {
                    return (
                      <div key={s.id} data-service={s.id} className="flex items-center gap-3 py-2 pl-4 pr-2">
                        {text}
                        <span className="flex shrink-0">
                          <IconButton label={t("services.moveUp", { name: s.name })} disabled={index === 0} onClick={() => dispatch({ type: "service/move", id: s.id, direction: "up" })}><ArrowUp size={18} /></IconButton>
                          <IconButton label={t("services.moveDown", { name: s.name })} disabled={index === services.length - 1} onClick={() => dispatch({ type: "service/move", id: s.id, direction: "down" })}><ArrowDown size={18} /></IconButton>
                        </span>
                      </div>
                    );
                  }
                  if (!canEdit) return <div key={s.id} data-service={s.id} className={`flex items-center gap-4 px-4 py-3.5 ${s.hidden ? "opacity-70" : ""}`}>{text}</div>;
                  return (
                    <div key={s.id} data-service={s.id}>
                      <button type="button" aria-label={t("services.edit", { name: s.name })} onClick={() => setOpen({ kind: "edit", id: s.id })} className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-2">
                        {text}
                        <ChevronRight aria-hidden size={18} className="shrink-0 text-text-secondary" />
                      </button>
                    </div>
                  );
                })}
                {!services.length && <p className="px-4 py-3.5 text-sm text-text-secondary">{t("services.empty")}</p>}
                {canEdit && !reordering && (
                  <div>
                    <button type="button" aria-label={`${t("services.add")}: ${category.name}`} onClick={() => setOpen({ kind: "add", category: category.id })} className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-[15px] font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text">
                      <Plus aria-hidden size={16} />
                      {t("services.add")}
                    </button>
                  </div>
                )}
              </Card>
            </Section>
          );
        })}
      </div>
      {open?.kind === "add" && <ServiceSheet state={state} category={open.category} onClose={() => setOpen(null)} onDelete={() => undefined} />}
      {open?.kind === "edit" && target && <ServiceSheet key={target.id} state={state} service={target} onClose={() => setOpen(null)} onDelete={(service) => setOpen({ kind: "delete", id: service.id })} />}
      {open?.kind === "delete" && target && <DeleteServiceSheet state={state} today={today} service={target} onClose={() => setOpen(null)} />}
      {open?.kind === "categories" && <CategoriesSheet state={state} onClose={() => setOpen(null)} />}
    </MorePage>
  );
}
