"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Customer } from "../../data/types";
import { t } from "../../i18n";
import { TRASH_DAYS } from "../../trash/trash";
import { Button } from "../../ui/button";
import { Sheet } from "../../ui/sheet";
import { dispatchWithUndoToast } from "../log/undo-toast";

/** Deleting a customer moves them to the Trash for 30 days instead of removing them. */
export function DeleteCustomer({ customer }: { customer: Customer }) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const remove = () => {
    const message = t("customer.deletedToast", { name: customer.firstName, days: TRASH_DAYS });
    if (!dispatchWithUndoToast({ type: "customer/delete", id: customer.id }, message)) return;
    setConfirming(false);
    router.push("/studio/customers");
  };

  return (
    <>
      <Button variant="ghost" className="w-full text-danger" icon={<Trash2 size={18} />} onClick={() => setConfirming(true)}>
        {t("customer.delete")}
      </Button>
      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t("customer.deleteTitle", { name: customer.firstName })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>{t("common.cancel")}</Button>
            <Button variant="danger" onClick={remove}>{t("customer.delete")}</Button>
          </>
        }
      >
        <p className="text-body">{t("customer.deleteText", { days: TRASH_DAYS })}</p>
      </Sheet>
    </>
  );
}
