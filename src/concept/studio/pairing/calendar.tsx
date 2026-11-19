"use client";

import { Field, Input, Select } from "@/concept/ui/controls";
import { ListRow } from "../../ui/list-row";
import { useState } from "react";
import { formatTime } from "../../data/dates";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { usePairing, type Pairing, type Workspace } from "./session";

export function PairedCalendar() {
  const pairing = usePairing();
  if (!pairing?.workspace) return null;
  return <CalendarEditor key={pairing.workspace.id} workspace={pairing.workspace} command={pairing.command} busy={pairing.busy} />;
}

function CalendarEditor({ workspace: w, command, busy }: Pick<Pairing, "command" | "busy"> & { workspace: Workspace }) {
  const [selected, setSelected] = useState("");
  const [edit, setEdit] = useState<{ workspaceId: string; bookingId: string; revision: number; idempotencyKey: string } | null>(null);
  const booking = w.bookings.find(b => b.bookingId === (selected || w.items[0]?.bookingId)) ?? w.bookings[0];
  if (!booking) return null;
  const schedule = w.bookings.filter(b => b.date === booking.date)
    .sort((a, b) => a.time.localeCompare(b.time) || a.staffId.localeCompare(b.staffId));
  return <Section title={t("pair.label")} className="mb-5"><Card className="space-y-3 p-5">
    <Field label={t("pair.appointment")}>
      <Select
        value={booking.bookingId} onChange={e => { setSelected(e.target.value); setEdit(null); }}>
        {w.bookings.map(b => <option key={b.bookingId} value={b.bookingId}>{b.date} · {b.time} · {b.untrustedCustomerText.customer}</option>)}
      </Select></Field>
    <p>{booking.date} · {booking.time} · {booking.untrustedCustomerText.customer} · {booking.untrustedCustomerText.service}</p>
    {edit && edit.bookingId === booking.bookingId ? <form className="flex flex-wrap items-end gap-3" onSubmit={async e => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      await command("move", { ...edit, date: form.get("date"), time: form.get("time") });
      setEdit(null);
    }}>
      <Field label={t("pair.date")}><Input required type="date" name="date" defaultValue={booking.date} /></Field>
      <Field label={t("pair.time")}><Input required type="time" name="time" defaultValue={booking.time} /></Field>
      <Button type="submit" disabled={busy}>{t("common.save")}</Button>
      <Button variant="ghost" onClick={() => setEdit(null)}>{t("common.cancel")}</Button>
    </form> : <Button size="sm" onClick={() => setEdit({ workspaceId: w.id, bookingId: booking.bookingId, revision: w.revision, idempotencyKey: crypto.randomUUID() })}>{t("pair.move")}</Button>}
  </Card>
    <Card className="divide-y divide-hairline px-5">
      <h3 className="py-3 font-semibold">{t("pair.schedule", { date: booking.date })}</h3>
      {schedule.map(b => <ListRow key={b.bookingId}
        leading={<time className="tabular-nums">{b.time}</time>} title={b.untrustedCustomerText.customer}
        meta={`${b.untrustedCustomerText.service} · ${b.staffName}`}
        onClick={() => { setSelected(b.bookingId); setEdit(null); }} />)}
    </Card>
    {w.blocks.length > 0 && <Card className="px-5 py-3"><h3 className="font-semibold">{t("pair.blocks")}</h3>
      <ul>{w.blocks.map(b => <li key={b.id}>{b.date} · {formatTime(b.start)}–{formatTime(b.end)} · {b.staffName} · {t(`pair.reason.${b.reason}`)}</li>)}</ul>
    </Card>}
  </Section>;
}
