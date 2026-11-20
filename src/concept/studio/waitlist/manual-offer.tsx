"use client";

import { useState } from "react";
import { manualGaps } from "../../booking/waitlist-match";
import type { DemoState, StaffId } from "../../data/types";
import { t } from "../../i18n";
import { formatTime } from "../../i18n/format";
import { findCustomer } from "../../selectors";
import { salonClock } from "../../tools/clock";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Field, Select, TextInput } from "../../ui/controls";
import { ListRow } from "../../ui/list-row";

/** Offer an existing open time to the first matching customer in line. */
export function ManualOffer({ state, now, onOffer }: { state: DemoState; now: number; onOffer: (gapId: string, opening: { date: string; staffId: StaffId }) => void }) {
  const today = salonClock(new Date(now)).today;
  const [date, setDate] = useState(today);
  const [staffId, setStaffId] = useState<StaffId | undefined>(state.staff[0]?.id);
  const gaps = staffId && date >= today ? manualGaps(state, date, staffId, now) : [];
  return (
    <Section title={t("offers.chooseOpening")}>
      <Card className="space-y-4 p-4 md:max-w-form">
        <div className="flex flex-wrap gap-4">
          <Field label={t("offers.day")} width="date">
            <TextInput type="date" width="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t("offers.staff")} width="short">
            <Select width="short" value={staffId} onChange={(e) => setStaffId(state.staff.find((s) => s.id === e.target.value)?.id)}>
              {state.staff.map((s) => <option key={s.id} value={s.id}>{s.firstName}</option>)}
            </Select>
          </Field>
        </div>
        {gaps.length ? (
          <div className="divide-y divide-hairline">
            {gaps.map(({ gap, match }) => (
              <ListRow
                key={gap.id}
                className="!px-0"
                title={formatTime(match.start)}
                meta={t("offers.nextInLine", { name: findCustomer(state, match.entry.customerId)?.firstName ?? "", service: match.service.name })}
                trailing={<Button size="sm" variant="secondary" onClick={() => staffId && onOffer(gap.id, { date, staffId })}>{t("offers.manual")}</Button>}
              />
            ))}
          </div>
        ) : (
          <p className="text-body text-text-secondary">{t("offers.noMatch")}</p>
        )}
      </Card>
    </Section>
  );
}
