"use client";

import { useState } from "react";
import { Eraser, FileJson, FileSpreadsheet, Pencil, Settings2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { journalSessionKey, journalsOnServer, readCustomerJournals } from "../../account/sync";
import { customerExport, customerExportCsv, customerExportFilename, customerExportJson, reviewCount } from "../../customers/export";
import type { Customer, DemoState } from "../../data/types";
import { isStub } from "../../journals/sealed";
import { t, tc } from "../../i18n";
import { currentTarget, targetOf, useDemo } from "../../store";
import { ActionMenu } from "../../ui/popover";
import { showToast } from "../../ui/toast";
import { download } from "../more/export";
import { useStudio } from "../use-studio";
import { DeleteCustomerSheet } from "./delete-customer";
import { EditCustomerSheet } from "./edit-customer";
import { EraseCustomerSheet } from "./erase-customer";

type Action = "edit" | "delete" | "erase";
const ICON = { size: 20, "aria-hidden": true, className: "shrink-0" } as const;

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

/**
 * What the owner can do about one customer's data, behind one button on the customer card: correct it, download a
 * copy, and apart from those, delete it (30 days in the trash) or erase it for good. Each keeps its own sheet.
 */
export function CustomerRights({ customer }: { customer: Customer }) {
  const { state } = useStudio();
  const saved = useDemo() ?? state;
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const close = () => setAction(null);

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
    <>
      <ActionMenu title={t("customer.rights.title")} icon={<Settings2 size={20} aria-hidden />} variant="secondary" sheetOnPhone
        groups={[
          [{ label: t("customer.edit"), icon: <Pencil {...ICON} />, run: () => setAction("edit") }],
          [
            { label: t("customer.export.json"), icon: <FileJson {...ICON} />, run: () => void save("json") },
            { label: t("customer.export.csv"), icon: <FileSpreadsheet {...ICON} />, run: () => void save("csv") },
          ],
          [
            { label: t("customer.delete"), icon: <Trash2 {...ICON} />, tone: "danger", run: () => setAction("delete") },
            { label: t("customer.erase"), icon: <Eraser {...ICON} />, tone: "danger", run: () => setAction("erase") },
          ],
        ]} />
      <EditCustomerSheet customer={customer} open={action === "edit"} onClose={close} />
      <DeleteCustomerSheet customer={customer} open={action === "delete"} onClose={close} />
      <EraseCustomerSheet customer={customer} open={action === "erase"} onClose={close} onErased={() => router.push("/studio/customers")} />
    </>
  );
}
