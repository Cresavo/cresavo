"use client";

import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import type { DemoState, Service, StaffId } from "../../data/types";
import { t } from "../../i18n";
import { DURATION_STEP, MAX_DESCRIPTION, MAX_DURATION, MAX_NAME, MIN_DURATION, serviceIssues, type ServiceDraft, type ServiceIssue } from "../../services/edit";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { Chip, Field, Select, Switch, TextArea, TextInput } from "../../ui/controls";
import { Notice } from "../../ui/notice";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";

interface ServiceSheetProps {
  state: DemoState;
  /** The treatment being edited; none means a new one. */
  service?: Service;
  /** Category a new treatment starts in. */
  category?: string;
  onClose: () => void;
  onDelete: (service: Service) => void;
}

const undoAction = () => ({ label: t("common.undo"), run: undo });

/**
 * Add or edit a treatment. Name, category, length and price are all most treatments need;
 * description, who can do it, visibility, duplicate and delete sit behind "More options".
 */
export function ServiceSheet({ state, service, category, onClose, onDelete }: ServiceSheetProps) {
  const [name, setName] = useState(service?.name ?? "");
  const [categoryId, setCategoryId] = useState(service?.category ?? category ?? state.categories[0]?.id ?? "");
  const [duration, setDuration] = useState(String(service?.duration ?? 60));
  const [price, setPrice] = useState(service ? String(service.price) : "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [staffIds, setStaffIds] = useState<StaffId[]>(service?.staffIds ?? state.staff.map((p) => p.id).slice(0, 1));
  const [visible, setVisible] = useState(!service?.hidden);
  const [tried, setTried] = useState(false);

  const draft: ServiceDraft = { name, category: categoryId, duration: Number(duration), price: price.trim() === "" ? Number.NaN : Number(price), description, staffIds };
  const issues = serviceIssues(state, draft, service?.id);
  const problem = (...kinds: ServiceIssue[]) => (tried ? kinds.find((kind) => issues.includes(kind)) : undefined);
  const hint = (...kinds: ServiceIssue[]) => {
    const issue = problem(...kinds);
    return issue ? t(`services.issue.${issue}`) : undefined;
  };

  const save = () => {
    setTried(true);
    if (issues.length) return;
    const label = name.trim();
    if (service) {
      const changed = dispatch({ type: "service/update", id: service.id, service: draft });
      const toggled = dispatch({ type: "service/visibility", id: service.id, hidden: !visible });
      if (changed || toggled) showToast(t("services.saved", { name: label }), changed !== toggled ? undoAction() : undefined);
    } else {
      dispatch({ type: "service/add", service: draft });
      showToast(t("services.added", { name: label }), undoAction());
    }
    onClose();
  };

  const duplicate = () => {
    if (!service) return;
    dispatch({ type: "service/duplicate", id: service.id, name: t("services.copyName", { name: service.name }) });
    showToast(t("services.duplicated", { name: service.name }), undoAction());
    onClose();
  };

  const toggleStaff = (id: StaffId) => setStaffIds((current) => (current.includes(id) ? current.filter((other) => other !== id) : [...current, id]));
  const moreIssue = problem("description", "staff");

  return (
    <Sheet
      open
      onClose={onClose}
      title={t(service ? "services.editTitle" : "services.addTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={save}>{t("common.save")}</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <Field label={t("services.name")} hint={hint("name", "nameTaken")}>
          <TextInput value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} aria-invalid={!!problem("name", "nameTaken")} autoFocus={!service} />
        </Field>
        <Field label={t("services.category")} hint={hint("category")}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("services.duration")}>
            <TextInput type="number" inputMode="numeric" min={MIN_DURATION} max={MAX_DURATION} step={DURATION_STEP} value={duration} onChange={(e) => setDuration(e.target.value)} aria-invalid={!!problem("duration")} />
          </Field>
          <Field label={t("services.price")}>
            <TextInput type="number" inputMode="numeric" min={0} step={5} value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={!!problem("price")} />
          </Field>
        </div>
        {(problem("duration") || problem("price")) && (
          <Notice tone="danger" role="alert">{[hint("duration"), hint("price")].filter(Boolean).join(" ")}</Notice>
        )}
        {service && <p className="text-xs text-text-secondary">{t("services.priceHint")}</p>}

        <details className="group border-t border-hairline pt-2" open={!!moreIssue || undefined}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-medium [&::-webkit-details-marker]:hidden">
            {t("services.moreOptions")}
            <span aria-hidden className="text-text-secondary transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="space-y-4 pb-1 pt-2">
            <Field label={t("services.description")} hint={hint("description") ?? t("services.descriptionHint")}>
              <TextArea value={description} maxLength={MAX_DESCRIPTION} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            {state.staff.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{t("services.staff")}</p>
                <div className="flex flex-wrap gap-2">
                  {state.staff.map((person) => (
                    <Chip key={person.id} active={staffIds.includes(person.id)} onClick={() => toggleStaff(person.id)}>{person.firstName}</Chip>
                  ))}
                </div>
                {problem("staff") && <p role="alert" className="text-xs text-danger">{t("services.issue.staff")}</p>}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t("services.visible")}</span>
                <span className="block text-xs text-text-secondary">{t("services.visibleHint")}</span>
              </span>
              <Switch checked={visible} onChange={() => setVisible((current) => !current)} label={t("services.visible")} />
            </div>
            {service && (
              <div className="flex flex-wrap gap-2 border-t border-hairline pt-3">
                <Button variant="secondary" size="sm" icon={<Copy size={16} />} onClick={duplicate}>{t("services.duplicate")}</Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={16} />} onClick={() => onDelete(service)}>{t("services.delete")}</Button>
              </div>
            )}
          </div>
        </details>
      </form>
    </Sheet>
  );
}
