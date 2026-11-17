"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { buildImportRows, guessMapping, IMPORT_FIELDS, parseCsv, type ImportProblem, type Mapping } from "@/concept/customers/csv";
import { t, tc } from "@/concept/i18n";
import type { MessageKey } from "@/concept/i18n";
import { dispatch, undo } from "@/concept/store";
import { BackLink } from "@/concept/studio/back-link";
import { PageHeader } from "@/concept/studio/page-header";
import { useStudio } from "@/concept/studio/use-studio";
import { Badge } from "@/concept/ui/badge";
import { Button, buttonClass } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { Field, Select } from "@/concept/ui/controls";
import { EmptyState } from "@/concept/ui/empty-state";
import { showToast } from "@/concept/ui/toast";

const EXAMPLE = "/demo/customers-example.csv";
const PREVIEW_ROWS = 12;
const PROBLEM_LABEL: Record<ImportProblem, MessageKey> = {
  duplicate: "import.status.duplicate",
  missingName: "import.status.missingName",
  missingPhone: "import.status.missingPhone",
};

export default function ImportCustomersPage() {
  const { state, today } = useStudio();
  const router = useRouter();
  const [table, setTable] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [error, setError] = useState(false);

  const load = (text: string) => {
    const rows = parseCsv(text);
    setError(rows.length < 2);
    setTable(rows.length < 2 ? null : rows);
    setMapping(rows.length < 2 ? {} : guessMapping(rows[0]));
  };
  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) load(await file.text());
    event.target.value = "";
  };
  const useExample = async () => {
    try {
      load(await (await fetch(EXAMPLE)).text());
    } catch {
      setError(true);
    }
  };

  const headers = table?.[0] ?? [];
  const rows = useMemo(
    () => (table ? buildImportRows(table.slice(1), mapping, state.customers, { since: today, preferredStaff: state.staff[0].id }) : []),
    [table, mapping, state.customers, state.staff, today],
  );
  const ready = rows.flatMap((row) => (row.customer ? [row.customer] : []));

  const runImport = () => {
    dispatch({ type: "customers/import", customers: ready });
    showToast(tc("import.done", ready.length), { label: t("common.undo"), run: undo });
    router.push("/studio/customers?filter=newThisYear");
  };

  return (
    <>
      <PageHeader title={t("import.title")} subtitle={t("import.subtitle")} back={<BackLink href="/studio/customers" label={t("import.back")} />} />
      <div className="space-y-6">
        <Card className="space-y-4 p-5">
          <p className="text-sm text-text-secondary">{t("import.hint")}</p>
          <div className="flex flex-wrap gap-2">
            <label className={`${buttonClass("primary")} cursor-pointer focus-within:ring-2 focus-within:ring-action`}>
              <Upload size={18} />
              {t("import.pick")}
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
            </label>
            <Button variant="secondary" icon={<FileSpreadsheet size={18} />} onClick={useExample}>{t("import.useExample")}</Button>
            <a href={EXAMPLE} download className={buttonClass("ghost")}>
              <Download size={18} />
              {t("import.downloadExample")}
            </a>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{t("import.empty")}</p>}
        </Card>

        {table && (
          <>
            <Section title={t("import.mapping")}>
              <Card className="space-y-4 p-5">
                <p className="text-sm text-text-secondary">{t("import.mappingHint")}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {IMPORT_FIELDS.map(({ field, label }) => (
                    <Field key={field} label={t(label)}>
                      <Select
                        value={mapping[field] ?? ""}
                        onChange={(e) => setMapping({ ...mapping, [field]: e.target.value === "" ? undefined : Number(e.target.value) })}
                      >
                        <option value="">{t("import.skip")}</option>
                        {headers.map((header, index) => <option key={index} value={index}>{header}</option>)}
                      </Select>
                    </Field>
                  ))}
                </div>
              </Card>
            </Section>

            <Section
              title={t("import.preview")}
              action={<span className="text-sm text-text-secondary">{t("import.summary", { ready: ready.length, skipped: rows.length - ready.length })}</span>}
            >
              {rows.length ? (
                <Card className="divide-y divide-border overflow-hidden">
                  {rows.slice(0, PREVIEW_ROWS).map((row) => (
                    <div key={row.line} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                      <div className="min-w-0 flex-1 basis-52">
                        <p className="truncate font-medium">{row.customer ? `${row.customer.firstName} ${row.customer.lastName}`.trim() : t("import.row", { line: row.line })}</p>
                        <p className="truncate text-sm text-text-secondary">{row.customer ? [row.customer.phone, row.customer.email].filter(Boolean).join(" · ") : ""}</p>
                      </div>
                      {row.birthdayIgnored && <Badge tone="warn">{t("import.birthdayIgnored")}</Badge>}
                      <Badge tone={row.problem ? "danger" : "accent"}>{t(row.problem ? PROBLEM_LABEL[row.problem] : "import.status.ready")}</Badge>
                    </div>
                  ))}
                </Card>
              ) : (
                <EmptyState icon={<FileSpreadsheet size={22} />} title={t("import.empty")} />
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setTable(null)}>{t("import.another")}</Button>
                <Button disabled={!ready.length} onClick={runImport}>{tc("import.button", ready.length)}</Button>
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  );
}
