import { useState } from "react";
import { monthlySmsEstimate, smsPriceOre } from "../../booking/reminders";
import type { MessageChannel } from "../../booking/messages";
import type { DateKey, DemoState } from "../../data/types";
import { locale, t } from "../../i18n";
import { formatNumber } from "../../i18n/format";
import { dispatch } from "../../store";
import { Badge } from "../../ui/badge";
import { ButtonLink } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Field, Segmented, TextInput } from "../../ui/controls";

function formatSek(ore: number) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "SEK" }).format(ore / 100);
}

export function ReminderSettings({ state, today }: { state: DemoState; today: DateKey }) {
  const settings = state.reminderSettings;
  const [draft, setDraft] = useState<string>();
  const draftPrice = draft === undefined ? settings.smsPriceOre : smsPriceOre(draft);
  const estimate = monthlySmsEstimate(state, today, { ...settings, smsPriceOre: draftPrice ?? settings.smsPriceOre });

  return (
    <Section title={t("reminders.title")} action={<Badge>{t("common.simulated")}</Badge>}>
      <Card className="space-y-4 p-4">
        <p className="text-sm text-text-secondary">{t("reminders.simulated")}</p>
        <Segmented<MessageChannel> label={t("reminders.channel")} value={settings.channel}
          options={(["sms", "email"] as const).map(value => ({ value, label: t(`messages.channel.${value}`) }))}
          onChange={channel => dispatch({ type: "reminder/settings", settings: { channel } })} />
        <Field label={t("reminders.smsPrice")} hint={draftPrice === undefined ? t("reminders.invalidPrice") : undefined}>
          <TextInput inputMode="decimal" value={draft ?? formatNumber(settings.smsPriceOre / 100, 2)}
            aria-invalid={draftPrice === undefined || undefined}
            onChange={event => setDraft(event.target.value)}
            onBlur={() => {
              if (draft === undefined || draftPrice === undefined) return;
              dispatch({ type: "reminder/settings", settings: { smsPriceOre: draftPrice } });
              setDraft(undefined);
            }} />
        </Field>
        <div className="space-y-1 rounded-md bg-surface-2 p-3" aria-live="polite">
          <p className="font-semibold">{t("reminders.estimate")}{draftPrice !== undefined && <> · {formatSek(estimate.totalOre)}</>}</p>
          {draftPrice !== undefined && <p className="text-sm text-text-secondary">{t("reminders.formula", {
            messages: formatNumber(estimate.smsPerBooking), bookings: formatNumber(estimate.bookings), price: formatSek(draftPrice),
          })}</p>}
          <p className="text-sm text-text-secondary">{t("reminders.assumptions")}</p>
        </div>
        <ButtonLink href="/studio/inbox?filter=sent" variant="secondary">{t("messages.log")}</ButtonLink>
      </Card>
    </Section>
  );
}
