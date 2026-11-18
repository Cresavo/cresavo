import { ArrowDown, ArrowUp, ChevronRight, Plus } from "lucide-react";
import { useId } from "react";
import type { DemoState, Service } from "../../data/types";
import { t } from "../../i18n";
import { formatDuration, formatMoney } from "../../i18n/format";
import type { Direction } from "../../services/edit";
import { IconButton } from "../../ui/button";
import { Card } from "../../ui/card";
import { dispatchWithUndoToast } from "../log/undo-toast";
import { ReorderItem, ReorderList } from "../reorder";

interface Props {
  state: Pick<DemoState, "categories" | "services" | "staff">;
  canEdit: boolean;
  showMoveButtons: boolean;
  onEdit: (id: string) => void;
  onAdd: (category: string) => void;
}

/** Treatments and their headings in the order customers see them. */
export function TreatmentList({ state, canEdit, showMoveButtons, onEdit, onAdd }: Props) {
  const staffNames = (service: Service) => state.staff.filter((p) => service.staffIds.includes(p.id)).map((p) => p.firstName).join(", ");

  return (
    <ReorderList
      items={state.categories}
      enabled={canEdit}
      onReorder={(items, { name }) => dispatchWithUndoToast({ type: "category/reorder", ids: items.map((item) => item.id) }, t("reorder.moved", { name }))}
    >
      <div className="space-y-7">
        {state.categories.map((category) => {
          const services = state.services.filter((s) => s.category === category.id);
          return (
            <ReorderItem key={category.id} id={category.id} name={category.name} enabled={canEdit} className="data-[dragging=true]:rounded-lg">
              {(handle) => (
                <section aria-label={category.name} className="space-y-2">
                  <div className="flex min-h-9 items-center">
                    {handle}
                    <h2 className="text-[17px] font-semibold tracking-tight">{category.name}</h2>
                  </div>
                  <ReorderList
                    items={services}
                    enabled={canEdit}
                    onReorder={(items, { name }) => dispatchWithUndoToast({ type: "service/reorder", category: category.id, ids: items.map((item) => item.id) }, t("reorder.moved", { name }))}
                  >
                    <Card className="divide-y divide-hairline">
                      {services.map((service, index) => (
                        <ReorderItem key={service.id} id={service.id} name={service.name} enabled={canEdit} className="flex flex-wrap items-center">
                          {(handle) => (
                            <>
                              {handle}
                              <TreatmentRow service={service} staff={staffNames(service)} onEdit={canEdit ? () => onEdit(service.id) : undefined} />
                              {showMoveButtons && <MoveButtons service={service} first={index === 0} last={index === services.length - 1} />}
                            </>
                          )}
                        </ReorderItem>
                      ))}
                      {!services.length && <p className="px-4 py-3.5 text-sm text-text-secondary">{t("services.empty")}</p>}
                      {canEdit && (
                        <div>
                          <button type="button" aria-label={t("services.addInCategory", { category: category.name })} onClick={() => onAdd(category.id)} className="flex min-h-11 w-full items-center gap-2 rounded-b-lg pl-11 pr-4 text-left text-[15px] font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text">
                            <Plus aria-hidden size={16} />
                            {t("services.add")}
                          </button>
                        </div>
                      )}
                    </Card>
                  </ReorderList>
                </section>
              )}
            </ReorderItem>
          );
        })}
      </div>
    </ReorderList>
  );
}

function MoveButtons({ service, first, last }: { service: Service; first: boolean; last: boolean }) {
  const move = (direction: Direction) => dispatchWithUndoToast(
    { type: "service/move", id: service.id, direction },
    t("reorder.moved", { name: service.name }),
  );
  return (
    <div className="flex basis-full justify-end gap-1 px-2 pb-2 sm:basis-auto sm:pb-0">
      <IconButton label={t("services.moveUp", { name: service.name })} disabled={first} onClick={() => move("up")}><ArrowUp size={18} aria-hidden /></IconButton>
      <IconButton label={t("services.moveDown", { name: service.name })} disabled={last} onClick={() => move("down")}><ArrowDown size={18} aria-hidden /></IconButton>
    </div>
  );
}

function TreatmentRow({ service, staff, onEdit }: { service: Service; staff: string; onEdit?: () => void }) {
  const detailsId = useId();
  const priceId = `${detailsId}-price`;
  const hiddenId = `${detailsId}-hidden`;
  const describedBy = [detailsId, priceId, service.hidden ? hiddenId : null].filter(Boolean).join(" ");

  return (
    <div className={`relative flex min-w-0 flex-1 items-center gap-2 self-stretch py-3.5 sm:gap-4 ${onEdit ? "rounded-md pr-3 transition-colors hover:bg-surface-2 motion-reduce:transition-none sm:pr-4" : "px-4"}`}>
      <span className="min-w-0 flex-1 break-words">
        <span className="block font-medium">
          {service.name}
          {service.hidden && <span id={hiddenId} className="ml-2 text-sm font-normal text-text-secondary">· {t("services.hidden")}</span>}
        </span>
        <span id={detailsId} className="block">
          {service.description && <span className="mt-0.5 block text-sm text-text-secondary">{service.description}</span>}
          <span className="mt-1 block text-sm text-text-secondary">{formatDuration(service.duration)} · {staff}</span>
        </span>
      </span>
      <span id={priceId} className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{formatMoney(service.price)}</span>
      {onEdit && (
        <>
          <ChevronRight aria-hidden size={16} className="shrink-0 text-text-secondary" />
          <button
            type="button"
            className="absolute inset-0 rounded-md"
            aria-label={t("services.edit", { name: service.name })}
            aria-describedby={describedBy}
            onClick={onEdit}
          />
        </>
      )}
    </div>
  );
}
