"use client";

import { useState } from "react";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { usePairing } from "./session";

export function PairedCalendar() {
  const pairing = usePairing();
  const [selected, setSelected] = useState("");
  const [edit, setEdit] = useState<{ revision: number; idempotencyKey: string } | null>(null);
  if (!pairing?.workspace) return null;
  const { workspace: w, command, busy } = pairing;
  const booking = w.bookings.find(b => b.bookingId === (selected || w.items[0]?.bookingId)) ?? w.bookings[0];
  if (!booking) return null;
  const schedule = w.bookings.filter(b => b.date === booking.date)
    .sort((a, b) => a.time.localeCompare(b.time) || a.staffId.localeCompare(b.staffId));
  return <Section title={t("pair.label")} className="mb-5"><Card className="space-y-3 p-5">
    <label className="block text-sm font-medium">{t("pair.appointment")}
      <select className="mt-1 block max-w-full rounded-md border border-hairline bg-surface p-2"
        value={booking.bookingId} onChange={e => { setSelected(e.target.value); setEdit(null); }}>
        {w.bookings.map(b => <option key={b.bookingId} value={b.bookingId}>{b.date} · {b.time} · {b.customer}</option>)}
      </select></label>
    <p>{booking.date} · {booking.time} · {booking.customer} · {booking.service}</p>
    {edit ? <form className="flex flex-wrap items-end gap-3" onSubmit={async e => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      await command("move", { workspaceId: w.id, ...edit,
        bookingId: booking.bookingId, date: form.get("date"), time: form.get("time") });
      setEdit(null);
    }}>
      <label>{t("pair.date")} <input required type="date" name="date" defaultValue={booking.date}/></label>
      <label>{t("pair.time")} <input required type="time" name="time" defaultValue={booking.time}/></label>
      <Button type="submit" disabled={busy}>{t("common.save")}</Button>
      <Button variant="ghost" onClick={() => setEdit(null)}>{t("common.cancel")}</Button>
    </form> : <Button variant="secondary" size="sm" onClick={() => setEdit({ revision: w.revision, idempotencyKey: crypto.randomUUID() })}>{t("pair.move")}</Button>}
  </Card>
    <Card className="divide-y divide-hairline px-5">
      <h3 className="py-3 font-semibold">{t("pair.schedule", { date: booking.date })}</h3>
      {schedule.map(b => <button key={b.bookingId} type="button"
        className="flex min-h-11 w-full flex-wrap items-center gap-x-4 py-2 text-left text-sm hover:bg-surface-2"
        onClick={() => { setSelected(b.bookingId); setEdit(null); }}>
        <time className="tabular-nums">{b.time}</time><span className="font-medium">{b.customer}</span>
        <span className="text-text-secondary">{b.service} · {b.staffId}</span>
      </button>)}
    </Card>
  </Section>;
}
