"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { readCustomerJournals } from "../../account/sync";
import { customerExport, customerExportCsv, customerExportFilename, customerExportJson, reviewCount } from "../../customers/export";
import type { Customer, DemoState } from "../../data/types";
import { isStub } from "../../journals/sealed";
import { t, tc } from "../../i18n";
import { useDemo } from "../../store";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { showToast } from "../../ui/toast";
import { download } from "../more/export";
import { useStudio } from "../use-studio";
import { DeleteCustomer } from "./delete-customer";
import { EditCustomer } from "./edit-customer";
import { EraseCustomer } from "./erase-customer";

/**
 * The salon with this customer's journal text, for their export. A salon whose server keeps journals holds stubs:
 * the text is read from the server (and the read logged there). Null when it could not be read, so an export never
 * leaves the journal out silently.
 */
async function withJournalText(state: DemoState, customerId: string): Promise<DemoState | null> {
  if (!state.journals.some((entry) => entry.customerId === customerId && isStub(entry))) return state;
  const entries = await readCustomerJournals(customerId);
  if (!entries) return null;
  const full = new Map(entries.map((entry) => [entry.id, entry]));
  return { ...state, journals: state.journals.map((entry) => (entry.customerId === customerId ? full.get(entry.id) ?? entry : entry)) };
}

/** What the owner can do about one customer's data: download a copy, correct it, delete it (30 days in the trash) or erase it for good. */
export function CustomerRights({ customer }: { customer: Customer }) {
  const { state } = useStudio();
  const saved = useDemo() ?? state;
  const router = useRouter();

  const save = async (extension: "json" | "csv") => {
    const source = await withJournalText(saved, customer.id);
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
