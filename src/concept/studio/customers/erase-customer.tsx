"use client";

import { useState } from "react";
import { Eraser } from "lucide-react";
import { eraseAccountCustomer, type ErasureReport } from "../../account/sync";
import { BRAND } from "../../brand";
import type { Customer } from "../../data/types";
import { t, tc } from "../../i18n";
import { fullName } from "../../selectors";
import { currentTarget, dispatch } from "../../store";
import { TRASH_DAYS } from "../../trash/trash";
import { Button } from "../../ui/button";
import { Field, TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";

/** Erases the customer in the salon this tab shows. An account salon is erased by the server, which also redacts its audit data. */
async function erase(customerId: string): Promise<ErasureReport | null> {
  if (currentTarget()?.workspace === "account") return eraseAccountCustomer(customerId);
  return dispatch({ type: "customer/erase", id: customerId }) ? { pendingPayments: 0, inFlightMessages: 0 } : null;
}

/** The final erasure (GDPR art. 17) with what goes, what stays and why, and a typed confirmation. */
export function EraseCustomerSheet({ customer, open, onClose, onErased }: { customer: Customer; open: boolean; onClose: () => void; onErased?: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const name = fullName(customer);
  const confirmed = typed.trim().toLowerCase() === name.trim().toLowerCase();

  const close = () => {
    setTyped("");
    onClose();
  };

  const run = async () => {
    setBusy(true);
    const report = await erase(customer.id);
    setBusy(false);
    if (!report) {
      showToast(t("customer.erase.failed"));
      return;
    }
    const notes = [report.pendingPayments ? tc("customer.erase.pending", report.pendingPayments) : "", report.inFlightMessages ? t("customer.erase.inFlight") : ""];
    showToast([t("customer.erase.done"), ...notes].filter(Boolean).join(" "));
    close();
    onErased?.();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t("customer.erase.title", { name })}
      footer={
        <>
          <Button variant="ghost" onClick={close}>{t("common.cancel")}</Button>
          <Button variant="danger" disabled={!confirmed} loading={busy} onClick={run}>{t("customer.erase.confirmButton")}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-body">{t("customer.erase.intro", { days: TRASH_DAYS })}</p>
        <section className="space-y-1">
          <h3 className="text-body font-semibold">{t("customer.erase.removesTitle")}</h3>
          <p className="text-body text-text-secondary">{t("customer.erase.removes")}</p>
        </section>
        <section className="space-y-1">
          <h3 className="text-body font-semibold">{t("customer.erase.keepsTitle")}</h3>
          <p className="text-body text-text-secondary">{t("customer.erase.keeps", { brand: BRAND.name })}</p>
        </section>
        <Field label={t("customer.erase.confirmLabel", { name })}>
          <TextInput value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/** A button that opens the erase sheet; after an erasure the customer's page no longer exists, so `onErased` leaves it. */
export function EraseCustomer({ customer, onErased }: { customer: Customer; onErased: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" width="responsive" className="text-danger" icon={<Eraser size={18} />} onClick={() => setOpen(true)}>{t("customer.erase")}</Button>
      <EraseCustomerSheet customer={customer} open={open} onClose={() => setOpen(false)} onErased={onErased} />
    </>
  );
}
