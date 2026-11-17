"use client";

import { useState } from "react";
import type { Booking, DemoState } from "../data/types";
import { t } from "../i18n";
import { dispatch } from "../store";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Segmented } from "../ui/controls";
import { showToast } from "../ui/toast";
import type { Now } from "../use-now";
import { bookingMessage, messageWasSent, type BookingMessageKind, type MessageChannel } from "./messages";

export function MessagePreviews({ state, booking, now }: { state: DemoState; booking: Booking; now: Now }) {
  const [kind, setKind] = useState<BookingMessageKind>("confirmation");
  const [channel, setChannel] = useState<MessageChannel>("sms");
  const message = bookingMessage(state, booking, kind);
  const sent = messageWasSent(state, booking, kind, channel);
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-semibold">{t("messages.title")}</h2>
      <p className="text-sm text-eko-muted">{t("messages.note")}</p>
      <Segmented value={kind} onChange={setKind} label={t("messages.kind")} options={(["confirmation", "reminder"] as const).map(value => ({ value, label: t(`messages.kind.${value}`) }))} className="w-full" />
      <Segmented value={channel} onChange={setChannel} label={t("messages.channel")} options={(["sms", "email"] as const).map(value => ({ value, label: t(`messages.channel.${value}`) }))} className="w-full" />
      <div className={channel === "sms" ? "rounded-2xl bg-eko-sunken p-4" : "rounded-xl border border-eko-line p-4"}>
        <p className="text-xs font-semibold text-eko-accent">{t("messages.from", { salon: state.salon.name })}</p>
        {channel === "email" && <div className="my-3 space-y-1 border-b border-eko-line pb-3 text-sm">
          <p className="text-eko-muted">{t("messages.to")}</p><p className="font-medium">{t("messages.subject", { subject: message.subject })}</p>
        </div>}
        <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed">{message.body}</p>
      </div>
      {sent ? <p role="status" className="text-sm text-eko-accent">{t("messages.sent")}</p> : <Button variant="secondary" onClick={() => {
        const ok = dispatch({ type: "booking-message/send", bookingId: booking.id, kind, channel, at: { date: now.today, time: now.minutes } });
        showToast(ok ? t("messages.sent") : t("command.failed"));
      }}>{t("messages.simulate")}</Button>}
      <Badge>{t("common.simulated")}</Badge>
    </Card>
  );
}
