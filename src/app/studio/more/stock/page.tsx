"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PackageCheck, ShoppingBag, ShoppingCart } from "lucide-react";
import type { StockItem } from "@/concept/data/types";
import { t, tc } from "@/concept/i18n";
import { lowStock } from "@/concept/selectors";
import { openOrders } from "@/concept/stock/delivery-note";
import { MorePage } from "@/concept/studio/more/more-page";
import { OrdersCard } from "@/concept/studio/stock/orders-card";
import { ProductSheet } from "@/concept/studio/stock/product-sheet";
import { PurchaseSheet } from "@/concept/studio/stock/purchase-sheet";
import { ReceiveSheet } from "@/concept/studio/stock/receive-sheet";
import { SellSheet } from "@/concept/studio/stock/sell-sheet";
import { StockList } from "@/concept/studio/stock/stock-list";
import { useStudio } from "@/concept/studio/use-studio";
import { Button } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";

type Sheet = { kind: "purchase" } | { kind: "receive"; orderId?: string } | { kind: "sell" } | { kind: "product"; item: StockItem } | null;

export default function StockPage() {
  const { state } = useStudio();
  const params = useSearchParams();
  const [sheet, setSheet] = useState<Sheet>(() =>
    params?.get("order") ? { kind: "purchase" } : params?.has("receive") ? { kind: "receive", orderId: params.get("receive") || undefined } : null,
  );
  const low = lowStock(state);
  const orders = openOrders(state);

  return (
    <MorePage
      title={t("nav.stock")}
      subtitle={tc("stock.subtitle", state.stock.length)}
      module="stock"
      actions={
        <>
          <Button variant="secondary" icon={<ShoppingBag size={18} />} onClick={() => setSheet({ kind: "sell" })}>{t("stock.sell")}</Button>
          <Button variant="secondary" icon={<PackageCheck size={18} />} onClick={() => setSheet({ kind: "receive" })}>{t("stock.receive")}</Button>
        </>
      }
    >
      <div className="space-y-6">
        {low.length > 0 && (
          <Card className="flex flex-wrap items-center gap-4 bg-warning-bg p-4 ring-warning/20">
            <ShoppingCart size={22} className="shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{tc("stock.lowTitle", low.length)}</p>
              <p className="text-sm text-text-secondary">{low.map((i) => i.name).join(", ")}</p>
            </div>
            <Button className="w-full sm:w-auto" onClick={() => setSheet({ kind: "purchase" })}>{t("stock.createOrder")}</Button>
          </Card>
        )}
        {orders.length > 0 && (
          <Section title={t("stock.orders")}>
            <OrdersCard orders={orders} onReceive={(orderId) => setSheet({ kind: "receive", orderId })} />
          </Section>
        )}
        <StockList onEdit={(item) => setSheet({ kind: "product", item })} />
      </div>
      {sheet?.kind === "purchase" && <PurchaseSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === "receive" && <ReceiveSheet orderId={sheet.orderId} onClose={() => setSheet(null)} />}
      {sheet?.kind === "sell" && <SellSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === "product" && <ProductSheet key={sheet.item.id} item={sheet.item} onClose={() => setSheet(null)} />}
    </MorePage>
  );
}
