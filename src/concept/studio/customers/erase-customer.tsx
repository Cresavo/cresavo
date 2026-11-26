"use client";

import { useState } from "react";
import { eraseAccountCustomer, type ErasureReport } from "../../account/sync";
import { BRAND } from "../../brand";
import type { Customer } from "../../data/types";
import { t, tc } from "../../i18n";
import { audioScope, forgetCustomerAudio, isAudioStoreUnavailable, journalAudioStore } from "../../journals/audio-store";
import { fullName } from "../../selectors";
import { currentState, currentTarget, dispatch } from "../../store";
import { TRASH_DAYS } from "../../trash/trash";
import { Button } from "../../ui/button";
import { Field, TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";

/** Erases the customer in the salon this tab shows. An account salon is erased by the server, which also redacts its audit data. */
async function erase(customerId: string, name: string): Promise<ErasureReport | null> {
  if (currentTarget()?.workspace === "account") return eraseAccountCustomer(customerId, name);
  return dispatch({ type: "customer/erase", id: customerId }) ? { pendingPayments: 0, inFlightMessages: 0 } : null;
}

/** The final erasure (GDPR art. 17) with what goes, what stays and why, and a typed confirmation. */
export function EraseCustomerSheet({ customer, open, onClose, onErased }: { customer: Customer; open: boolean; onClose: () => void; onErased?: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const name = fullName(customer);
  const confirmed = typed.trim().toLowerCase() === name.trim().toLowerCase();

  const close = () => {
    setTyped("");
    setAudioBlocked(false);
    onClose();
  };

  const run = async () => {
    setBusy(true);
    try {
      // Recordings live only in this browser; remove them before the customer so a failure can be retried.
      const scope = audioScope(currentTarget() ?? { workspace: "demo", epoch: "legacy" }, currentState()?.salon);
      if (!audioBlocked) {
        try {
          await journalAudioStore().removeCustomer(customer.id, scope);
        } catch (error) {
          if (isAudioStoreUnavailable(error)) {
            setAudioBlocked(true);
            showToast(t("journal.audio.eraseUnavailable"));
            return;
          }
          showToast(t("journal.audio.eraseFailed"));
          return;
        }
      } else {
        // Storage is still blocked: remember the customer so the recordings go when it works again.
        await forgetCustomerAudio(customer.id, scope);
      }
      const report = await erase(customer.id, name);
      if (!report) {
        showToast(t("customer.erase.failed"));
        return;
      }
      const notes = [report.pendingPayments ? tc("customer.erase.pending", report.pendingPayments) : "", report.inFlightMessages ? t("customer.erase.inFlight") : ""];
      showToast([t("customer.erase.done"), ...notes].filter(Boolean).join(" "));
      close();
      onErased?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t("customer.erase.title", { name })}
      footer={
        <>
          <Button variant="ghost" onClick={close}>{t("common.cancel")}</Button>
          <Button variant="danger" disabled={!confirmed} loading={busy} onClick={run}>{t(audioBlocked ? "journal.audio.eraseAnyway" : "customer.erase.confirmButton")}</Button>
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
        {audioBlocked && <p className="text-body text-text-secondary">{t("journal.audio.eraseUnavailable")}</p>}
        <Field label={t("customer.erase.confirmLabel", { name })}>
          <TextInput value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
