"use client";

import { useRouter } from "next/navigation";
import type { Customer } from "../../data/types";
import { t } from "../../i18n";
import { TRASH_DAYS } from "../../trash/trash";
import { Button } from "../../ui/button";
import { Sheet } from "../../ui/sheet";
import { dispatchWithUndoToast } from "../log/undo-toast";

/** Deleting a customer moves them to the Trash for 30 days instead of removing them. */
export function DeleteCustomerSheet({ customer, open, onClose }: { customer: Customer; open: boolean; onClose: () => void }) {
  const router = useRouter();

  const remove = () => {
    const message = t("customer.deletedToast", { name: customer.firstName, days: TRASH_DAYS });
    if (!dispatchWithUndoToast({ type: "customer/delete", id: customer.id }, message)) return;
    onClose();
    router.push("/studio/customers");
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("customer.deleteTitle", { name: customer.firstName })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="danger" onClick={remove}>{t("customer.delete")}</Button>
        </>
      }
    >
      <p className="text-body">{t("customer.deleteText", { days: TRASH_DAYS })}</p>
    </Sheet>
  );
}
