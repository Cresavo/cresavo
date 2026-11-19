"use client";

import { useState } from "react";
import type { Booking, DemoState } from "../data/types";
import { ownerViewHref } from "../page/resolve";
import { t } from "../i18n";
import { dispatch } from "../store";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Segmented } from "../ui/controls";
import { showActionFailure, showToast } from "../ui/toast";
import type { Now } from "../use-now";
import { bookingMessage, messageWasSent, type BookingMessageKind, type MessageChannel } from "./messages";

export function MessagePreviews({ state, booking, now }: { state: DemoState; booking: Booking; now: Now }) {
  const [kind, setKind] = useState<BookingMessageKind>("confirmation");
  const [override, setChannel] = useState<MessageChannel>();
  const channel = override ?? (kind === "reminder" ? state.reminderSettings.channel : "sms");
  const message = bookingMessage(state, booking, kind);
  const ownerOrigin = new URL(ownerViewHref(window.location.host, window.location.protocol), window.location.href).origin;
  const sentText = t(ownerOrigin === window.location.origin ? "messages.sent" : "messages.sentLocally");
  const sent = messageWasSent(state, booking, kind, channel);
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-semibold">{t("messages.title")}</h2>
      <p className="text-sm text-text-secondary">{t("messages.note")}</p>
      <Segmented value={kind} onChange={setKind} label={t("messages.kind")} options={(["confirmation", "reminder"] as const).map(value => ({ value, label: t(`messages.kind.${value}`) }))} className="w-full" />
      <Segmented value={channel} onChange={setChannel} label={t("messages.channel")} options={(["sms", "email"] as const).map(value => ({ value, label: t(`messages.channel.${value}`) }))} className="w-full" />
      <div className={channel === "sms" ? "rounded-lg bg-surface-2 p-4" : "rounded-md border border-hairline p-4"}>
        <p className="text-xs font-semibold text-action">{t("messages.from", { salon: state.salon.name })}</p>
        {channel === "email" && <div className="my-3 space-y-1 border-b border-hairline pb-3 text-sm">
          <p className="text-text-secondary">{t("messages.to")}</p><p className="font-medium">{t("messages.subject", { subject: message.subject })}</p>
        </div>}
        <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed">{message.details}</p>
      </div>
      {sent ? <p role="status" className="text-sm text-action">{sentText}</p> : <Button variant="secondary" onClick={() => {
        const ok = dispatch({ type: "booking-message/send", bookingId: booking.id, kind, channel, at: { date: now.today, time: now.minutes } });
        if (ok) showToast(sentText);
        else showActionFailure(t("messages.failed"), undefined, "booking");
      }}>{t("messages.simulate")}</Button>}
      <Badge>{t("common.simulated")}</Badge>
    </Card>
  );
}
