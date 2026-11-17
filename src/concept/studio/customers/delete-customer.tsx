"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Customer } from "../../data/types";
import { t } from "../../i18n";
import { TRASH_DAYS } from "../../trash/trash";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";

/** Deleting a customer moves them to the Trash for 30 days instead of removing them. */
export function DeleteCustomer({ customer }: { customer: Customer }) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const remove = () => {
    if (!dispatch({ type: "customer/delete", id: customer.id })) return;
    setConfirming(false);
    router.push("/studio/customers");
    showToast(t("customer.deletedToast", { name: customer.firstName, days: TRASH_DAYS }), { label: t("common.undo"), run: undo });
  };

  return (
    <>
      <Button variant="ghost" className="w-full text-eko-danger" icon={<Trash2 size={18} />} onClick={() => setConfirming(true)}>
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
        <p className="text-[15px]">{t("customer.deleteText", { days: TRASH_DAYS })}</p>
      </Sheet>
    </>
  );
}
