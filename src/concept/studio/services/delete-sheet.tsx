"use client";

import type { DateKey, DemoState, Service } from "../../data/types";
import { t, tc } from "../../i18n";
import { serviceUsage } from "../../services/edit";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { Notice } from "../../ui/notice";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";

/**
 * Deleting says what it means before it happens. Upcoming bookings are never cancelled or
 * rewritten: the owner either hides the treatment or deletes it and keeps them as they are.
 */
export function DeleteServiceSheet({ state, today, service, onClose }: { state: DemoState; today: DateKey; service: Service; onClose: () => void }) {
  const usage = serviceUsage(state, service.id, today);
  const last = state.services.length === 1;
  const undoAction = { label: t("common.undo"), run: undo };

  const remove = () => {
    dispatch({ type: "service/delete", id: service.id });
    showToast(t("services.deleted", { name: service.name }), undoAction);
    onClose();
  };
  const hide = () => {
    dispatch({ type: "service/visibility", id: service.id, hidden: true });
    showToast(t("services.hiddenToast", { name: service.name }), undoAction);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("services.deleteTitle", { name: service.name })}
      footer={
        last ? (
          <Button variant="secondary" onClick={onClose}>{t("common.close")}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
            {usage.upcoming > 0 && !service.hidden && <Button variant="secondary" onClick={hide}>{t("services.hideInstead")}</Button>}
            <Button variant="danger" onClick={remove}>{t(usage.upcoming > 0 ? "services.deleteKeep" : "services.delete")}</Button>
          </>
        )
      }
    >
      {last ? (
        <Notice tone="warning">{t("services.deleteLast")}</Notice>
      ) : (
        <div className="space-y-3 text-[15px]">
          {usage.upcoming > 0 ? (
            <Notice tone="warning" role="alert">
              <strong className="font-semibold">{tc("services.deleteUpcoming", usage.upcoming)}</strong> {t("services.deleteKeeps")}
            </Notice>
          ) : (
            <p>{t("services.deleteFree")}</p>
          )}
          <ul className="space-y-1.5 text-text-secondary">
            {usage.upcoming > 0 && <li>{t("services.deleteGone")}</li>}
            {usage.past > 0 && <li>{tc("services.deletePast", usage.past)}</li>}
            {usage.packages > 0 && <li>{tc("services.deletePackages", usage.packages)}</li>}
            {usage.campaigns > 0 && <li>{tc("services.deleteCampaigns", usage.campaigns)}</li>}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
