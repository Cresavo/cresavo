"use client";

import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { t, tc } from "../../i18n";
import { formatDayMonth } from "../../i18n/format";
import { openOrders, readDeliveryNote } from "../../stock/delivery-note";
import { Button } from "../../ui/button";
import { Chip, Select } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import { Stepper } from "./stepper";
import { dispatchWithUndoToast } from "../log/undo-toast";

const OTHER = "other";
const READING_MS = 900;

/** Goods in: what arrived against an open order, or any delivery typed in or "read" from a photographed note. */
export function ReceiveSheet({ orderId, onClose }: { orderId?: string; onClose: () => void }) {
  const { state, today } = useStudio();
  const open = openOrders(state);
  const [choice, setChoice] = useState(orderId && open.some((o) => o.id === orderId) ? orderId : (open[0]?.id ?? OTHER));
  const order = open.find((o) => o.id === choice);
  const ordered = (id: string) => order?.lines.find((l) => l.stockId === id)?.quantity ?? 0;
  const [amounts, setAmounts] = useState<Record<string, number>>(() => Object.fromEntries((order?.lines ?? []).map((l) => [l.stockId, l.quantity])));
  const [reading, setReading] = useState(false);
  const [noteFrom, setNoteFrom] = useState<string | null>(null);

  const pick = (next: string) => {
    const nextOrder = open.find((o) => o.id === next);
    setChoice(next);
    setAmounts(Object.fromEntries((nextOrder?.lines ?? []).map((l) => [l.stockId, l.quantity])));
    setNoteFrom(null);
  };

  const photograph = () => {
    setReading(true);
    window.setTimeout(() => {
      const note = readDeliveryNote(state, order);
      setAmounts(Object.fromEntries(note.deliveries.map((d) => [d.stockId, d.quantity])));
      setNoteFrom(note.supplier);
      setReading(false);
    }, READING_MS);
  };

  const ids = Object.keys(amounts);
  const received = ids.filter((id) => amounts[id] > 0).length;
  const confirm = () => {
    dispatchWithUndoToast({ type: "stock/receive", orderId: order?.id, deliveries: ids.map((id) => ({ stockId: id, quantity: amounts[id] })), date: today }, tc("stock.receivedToast", received));
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("stock.receiveTitle")}
      description={t("stock.receiveDescription")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!received || reading} onClick={confirm}>{t("stock.confirmReceive")}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {open.map((o) => (
            <Chip key={o.id} active={choice === o.id} onClick={() => pick(o.id)}>
              {o.supplier} · {formatDayMonth(o.date)}
            </Chip>
          ))}
          <Chip active={choice === OTHER} onClick={() => pick(OTHER)}>{t("stock.otherDelivery")}</Chip>
        </div>
        <Button variant="secondary" className="w-full" disabled={reading} icon={reading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />} onClick={photograph}>
          {reading ? t("stock.reading") : t("stock.photo")}
        </Button>
        {noteFrom && <p className="rounded-md bg-action-bg px-3.5 py-2.5 text-sm text-text">{t("stock.noteRead", { supplier: noteFrom })}</p>}
        {ids.length > 0 && (
          <ul className="divide-y divide-hairline rounded-lg ring-1 ring-hairline">
            {ids.map((id) => {
              const item = state.stock.find((s) => s.id === id);
              if (!item) return null;
              return (
                <li key={id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{item.name}</span>
                    <span className="block text-text-secondary">{ordered(id) ? t("stock.orderedCount", { count: ordered(id) }) : item.unit}</span>
                  </span>
                  <Stepper
                    value={amounts[id]}
                    onChange={(value) => setAmounts({ ...amounts, [id]: value })}
                    lessLabel={t("stock.fewer", { name: item.name })}
                    moreLabel={t("stock.more", { name: item.name })}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {!order && (
          <div className="space-y-2">
            {ids.length === 0 && <p className="text-sm text-text-secondary">{t("stock.nothingOnOrder")}</p>}
            <Select
              aria-label={t("stock.addProduct")}
              value=""
              onChange={(event) => event.target.value && setAmounts({ ...amounts, [event.target.value]: amounts[event.target.value] ?? 1 })}
            >
              <option value="">{t("stock.addProduct")}</option>
              {state.stock.filter((s) => !(s.id in amounts)).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
        )}
      </div>
    </Sheet>
  );
}
