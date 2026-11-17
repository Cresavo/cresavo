import { ShoppingBag } from "lucide-react";
import { t } from "../../i18n";
import { formatDate, formatMoney } from "../../i18n/format";
import { Card, Section } from "../../ui/card";
import { useStudio } from "../use-studio";

/** Products a customer has bought, newest first. Shows nothing when there are none. */
export function CustomerProducts({ customerId }: { customerId: string }) {
  const { state } = useStudio();
  const sales = state.sales.filter((s) => s.customerId === customerId).sort((a, b) => b.date.localeCompare(a.date));
  if (!sales.length) return null;
  return (
    <Section title={t("stock.customerProducts")}>
      <Card className="divide-y divide-eko-line overflow-hidden">
        {sales.map((sale) => (
          <div key={sale.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5 text-sm">
            <span className="w-24 shrink-0 font-medium">{formatDate(sale.date)}</span>
            <ShoppingBag size={16} className="shrink-0 text-eko-muted" />
            <span className="min-w-0 flex-1">{t("stock.soldRow", { product: state.stock.find((s) => s.id === sale.stockId)?.name ?? "", count: sale.quantity })}</span>
            <span className="shrink-0 tabular-nums text-eko-muted">{formatMoney(sale.amount)}</span>
          </div>
        ))}
      </Card>
    </Section>
  );
}
