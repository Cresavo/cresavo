"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { journalSessionKey, journalsOnServer, readCustomerJournals } from "../../account/sync";
import { customerExport, customerExportCsv, customerExportFilename, customerExportJson, reviewCount } from "../../customers/export";
import type { Customer, DemoState } from "../../data/types";
import { isStub } from "../../journals/sealed";
import { t, tc } from "../../i18n";
import { currentTarget, targetOf, useDemo } from "../../store";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { showToast } from "../../ui/toast";
import { download } from "../more/export";
import { useStudio } from "../use-studio";
import { DeleteCustomer } from "./delete-customer";
import { EditCustomer } from "./edit-customer";
import { EraseCustomer } from "./erase-customer";

/**
 * The salon with this customer's journal text, for their export. While the server keeps journals the customer's
 * journal is always read from the server (and the read logged there), whatever the browser holds, and it replaces
 * the customer's entries here. Null when it could not be read, so an export never leaves the journal out silently.
 */
async function withJournalText(state: DemoState, customerId: string, fromServer: boolean, session: string): Promise<DemoState | null> {
  // A browser workspace exports what it holds and never asks a server; stubs without a server to read are no export.
  if (!fromServer) return state.journals.some((entry) => entry.customerId === customerId && isStub(entry)) ? null : state;
  const entries = await readCustomerJournals(customerId);
  // The text belongs to the snapshot only if the same login still shows the same signed-in salon.
  if (!entries || journalSessionKey() !== session || !journalsOnServer()) return null;
  return { ...state, journals: [...state.journals.filter((entry) => entry.customerId !== customerId), ...entries] };
}

/** What the owner can do about one customer's data: download a copy, correct it, delete it (30 days in the trash) or erase it for good. */
export function CustomerRights({ customer }: { customer: Customer }) {
  const { state } = useStudio();
  const saved = useDemo() ?? state;
  const router = useRouter();

  const save = async (extension: "json" | "csv") => {
    // Mode and login are fixed with the snapshot, when the owner asks for the file. With a signed-in salon on either
    // side, the salon rendered here must be the one open now, in the same lifetime, or nothing is fetched or saved.
    const target = targetOf(saved);
    const now = currentTarget();
    const account = target?.workspace === "account" || now?.workspace === "account";
    if (account && (!target || !now || target.workspace !== now.workspace || target.epoch !== now.epoch)) {
      showToast(t("customer.export.journalFailed"));
      return;
    }
    const source = await withJournalText(saved, customer.id, account && journalsOnServer(), journalSessionKey());
    if (!source) {
      showToast(t("customer.export.journalFailed"));
      return;
    }
    const data = customerExport(source, customer.id, new Date().toISOString());
    if (!data) return;
    download(customerExportFilename(data, extension), extension === "json" ? customerExportJson(data) : customerExportCsv(data), extension === "json" ? "application/json" : "text/csv");
    const waiting = reviewCount(data);
    showToast(waiting ? `${t("customer.export.done")} ${tc("customer.export.review", waiting)}` : t("customer.export.done"));
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="space-y-1">
        <h2 className="text-h3 font-semibold">{t("customer.rights.title")}</h2>
        <p className="text-meta text-text-secondary">{t("customer.rights.text")}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="secondary" width="responsive" icon={<Download size={18} />} onClick={() => void save("json")}>{t("customer.export.json")}</Button>
        <Button variant="secondary" width="responsive" icon={<Download size={18} />} onClick={() => void save("csv")}>{t("customer.export.csv")}</Button>
      </div>
      <p className="text-meta text-text-secondary">{t("customer.export.hint")}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <EditCustomer customer={customer} />
        <DeleteCustomer customer={customer} />
        <EraseCustomer customer={customer} onErased={() => router.push("/studio/customers")} />
      </div>
    </Card>
  );
}
