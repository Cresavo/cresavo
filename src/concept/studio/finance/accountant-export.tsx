"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { BRAND } from "../../brand";
import { addDays } from "../../data/dates";
import { exportRange, salesCsv, sieFile } from "../../finance/accounting";
import { t } from "../../i18n";
import { formatDate } from "../../i18n/format";
import { Button } from "../../ui/button";
import { Sheet } from "../../ui/sheet";
import { download } from "../more/export";
import { useStudio } from "../use-studio";

const EXPORT_PREFIX = BRAND.name.toLowerCase();

export function AccountantExport({ secondary = false }: { secondary?: boolean }) {
  const { state, today, minutes } = useStudio();
  const [open, setOpen] = useState(false);
  const clock = { today, minutes };
  const period = exportRange(clock);
  const title = t("finance.sendToAccountant");

  return (
    <>
      <Button variant={secondary ? "secondary" : "primary"} onClick={() => setOpen(true)}>{title}</Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={t("finance.exportPeriod", {
          from: formatDate(period.start),
          to: formatDate(addDays(period.end, -1)),
        })}
      >
        <div className="space-y-4">
          <p className="text-body">{t("finance.exportHow")}</p>
          <div className="space-y-2">
            <p className="text-body text-text-secondary">{t("finance.bookkeepingFileText")}</p>
            <Button icon={<Download size={16} />} onClick={() => download(`${EXPORT_PREFIX}-bookkeeping.sie`, sieFile(state, clock), "text/plain")}>
              {t("finance.downloadBookkeeping")}
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-body text-text-secondary">{t("finance.salesFileText")}</p>
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => download(`${EXPORT_PREFIX}-sales.csv`, salesCsv(state, clock), "text/csv")}>
              {t("finance.downloadSales")}
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
