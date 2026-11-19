import { ListRow } from "../../ui/list-row";
import { ArrowDown, ArrowUp, ChevronRight, Plus } from "lucide-react";
import { useId } from "react";
import type { DemoState, Service } from "../../data/types";
import { t } from "../../i18n";
import { formatDuration, formatMoney } from "../../i18n/format";
import type { Direction } from "../../services/edit";
import { Button, IconButton } from "../../ui/button";
import { Badge } from "../../ui/badge";
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
      <div className="space-y-8">
        {state.categories.map((category) => {
          const services = state.services.filter((s) => s.category === category.id);
          return (
            <ReorderItem key={category.id} id={category.id} name={category.name} enabled={canEdit} className="data-[dragging=true]:rounded-lg">
              {(handle) => (
                <section aria-label={category.name} className="space-y-2">
                  <div className="flex min-h-9 items-center">
                    {handle}
                    <h2 className="text-h3 font-semibold tracking-tight">{category.name}</h2>
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
                      {!services.length && <p className="px-4 py-4 text-sm text-text-secondary">{t("services.empty")}</p>}
                      {canEdit && (
                        <div>
                          <Button variant="tertiary" align="start" width="responsive" aria-label={t("services.addInCategory", { category: category.name })} onClick={() => onAdd(category.id)} className="!pl-12 text-text-secondary hover:text-text">
                            <Plus aria-hidden size={16} />
                            {t("services.add")}
                          </Button>
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
    <ListRow
      className="flex-1"
      onClick={onEdit}
      aria-label={onEdit ? t("services.edit", { name: service.name }) : undefined}
      aria-describedby={onEdit ? describedBy : undefined}
      title={<span className="flex flex-wrap items-center gap-2">
        {service.name}
        {service.hidden && <Badge className="font-normal"><span id={hiddenId}>{t("services.hidden")}</span></Badge>}
      </span>}
      meta={<span id={detailsId} className="block">
        {service.description && <span className="block">{service.description}</span>}
        <span className="block">{formatDuration(service.duration)} · {staff}</span>
      </span>}
      trailing={<>
        <span id={priceId} className="shrink-0 text-meta font-semibold tabular-nums">{formatMoney(service.price)}</span>
        {onEdit && <ChevronRight aria-hidden size={16} className="shrink-0 text-text-secondary" />}
      </>}
    />
  );
}
