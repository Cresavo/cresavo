"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { t, tc } from "@/concept/i18n";
import { useRole } from "@/concept/ops/role";
import { MorePage } from "@/concept/studio/more/more-page";
import { CategoriesSheet } from "@/concept/studio/services/categories-sheet";
import { DeleteServiceSheet } from "@/concept/studio/services/delete-sheet";
import { ServiceSheet } from "@/concept/studio/services/service-sheet";
import { TreatmentList } from "@/concept/studio/services/treatment-list";
import { useStudio } from "@/concept/studio/use-studio";
import { EmptyState } from "@/concept/ui/empty-state";
import { Button } from "@/concept/ui/button";
import { Notice } from "@/concept/ui/notice";

type Open = { kind: "edit"; id: string } | { kind: "add"; category?: string } | { kind: "delete"; id: string } | { kind: "categories" } | null;

/** The price list: every treatment under its heading, in the order the booking page shows them. */
export default function ServicesPage() {
  const { state, today } = useStudio();
  const canEdit = useRole() === "owner";
  const [open, setOpen] = useState<Open>(null);
  const [showMoveButtons, setShowMoveButtons] = useState(false);
  const hidden = state.services.filter((s) => s.hidden).length;
  const target = open && "id" in open ? state.services.find((s) => s.id === open.id) : undefined;

  const empty = state.industry && !state.services.length;
  return (
    <MorePage
      title={t("nav.services")}
      subtitle={[tc("services.subtitle", state.services.length), hidden ? t("services.subtitleHidden", { count: hidden }) : ""].filter(Boolean).join(" · ")}
      actions={
        canEdit && !empty && (
          <>
            <Button variant="ghost" size="sm" className="aria-pressed:bg-surface-2" aria-pressed={showMoveButtons} onClick={() => setShowMoveButtons((current) => !current)}>
              {t("services.reorder")}
            </Button>
            <Button data-help-id="services.categories" variant="secondary" size="sm" onClick={() => setOpen({ kind: "categories" })}>{t("services.categories")}</Button>
            <Button data-help-id="services.add" size="sm" icon={<Plus size={18} />} onClick={() => setOpen({ kind: "add" })}>{t("services.add")}</Button>
          </>
        )
      }
    >
      {!canEdit && <Notice tone="info" className="mb-5">{t("services.readOnly")}</Notice>}
      {empty ? <EmptyState icon={<Plus size={22} />} title={t("setup.empty.treatments")}
        action={canEdit && <Button data-help-id="services.add" onClick={() => setOpen({ kind: "add" })}>{t("services.add")}</Button>} /> : <TreatmentList
        state={state}
        canEdit={canEdit}
        showMoveButtons={canEdit && showMoveButtons}
        onEdit={(id) => setOpen({ kind: "edit", id })}
        onAdd={(category) => setOpen({ kind: "add", category })}
      />}
      {open?.kind === "add" && <ServiceSheet state={state} category={open.category} onClose={() => setOpen(null)} onDelete={() => undefined} />}
      {open?.kind === "edit" && target && <ServiceSheet key={target.id} state={state} service={target} onClose={() => setOpen(null)} onDelete={(service) => setOpen({ kind: "delete", id: service.id })} />}
      {open?.kind === "delete" && target && <DeleteServiceSheet state={state} today={today} service={target} onClose={() => setOpen(null)} />}
      {open?.kind === "categories" && <CategoriesSheet state={state} onClose={() => setOpen(null)} />}
    </MorePage>
  );
}
