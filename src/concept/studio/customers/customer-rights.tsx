"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { customerExport, customerExportCsv, customerExportFilename, customerExportJson } from "../../customers/export";
import type { Customer } from "../../data/types";
import { t } from "../../i18n";
import { useDemo } from "../../store";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { showToast } from "../../ui/toast";
import { download } from "../more/export";
import { useStudio } from "../use-studio";
import { DeleteCustomer } from "./delete-customer";
import { EditCustomer } from "./edit-customer";
import { EraseCustomer } from "./erase-customer";

/** What the owner can do about one customer's data: download a copy, correct it, delete it (30 days in the trash) or erase it for good. */
export function CustomerRights({ customer }: { customer: Customer }) {
  const { state } = useStudio();
  const saved = useDemo() ?? state;
  const router = useRouter();

  const save = (extension: "json" | "csv") => {
    const data = customerExport(saved, customer.id, new Date().toISOString());
    if (!data) return;
    download(customerExportFilename(data, extension), extension === "json" ? customerExportJson(data) : customerExportCsv(data), extension === "json" ? "application/json" : "text/csv");
    showToast(t("customer.export.done"));
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="space-y-1">
        <h2 className="text-h3 font-semibold">{t("customer.rights.title")}</h2>
        <p className="text-meta text-text-secondary">{t("customer.rights.text")}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="secondary" width="responsive" icon={<Download size={18} />} onClick={() => save("json")}>{t("customer.export.json")}</Button>
        <Button variant="secondary" width="responsive" icon={<Download size={18} />} onClick={() => save("csv")}>{t("customer.export.csv")}</Button>
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
