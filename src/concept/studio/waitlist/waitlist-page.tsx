"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { nextMatch, queueOrder } from "../../booking/waitlist-match";
import { offerLink } from "../../booking/waitlist-offer";
import type { WaitlistOffer } from "../../booking/waitlist-types";
import type { DemoState, StaffId } from "../../data/types";
import { t } from "../../i18n";
import { formatDayShort, formatTime } from "../../i18n/format";
import { findCustomer, findService, fullName } from "../../selectors";
import { dispatch, withBookingLock } from "../../store";
import { Badge, DemoBadge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { EmptyState } from "../../ui/empty-state";
import { ListRow } from "../../ui/list-row";
import { showToast } from "../../ui/toast";
import { MorePage } from "../more/more-page";
import { useStudio } from "../use-studio";
import { entrySummary } from "../../booking/waitlist-entry";
import { ManualOffer } from "./manual-offer";
import { OfferSettings } from "./offer-settings";

/** Seconds tick only while a countdown is on screen. */
function useInstant(ticking: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);
  return now;
}

const countdown = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const STATUS_TONE = { offered: "accent", claimed: "accent", lapsed: "neutral", declined: "neutral" } as const;

/** Customers > Waiting list: who waits, which freed times are ready to offer, offers out now and earlier ones. */
export function WaitlistPage() {
  const { state } = useStudio();
  const active = state.waitlistOffers.filter((o) => o.status === "offered");
  const now = useInstant(active.length > 0 || state.waitlistGaps.length > 0);
  const name = (id: string) => {
    const customer = findCustomer(state, id);
    return customer ? fullName(customer) : t("log.someone");
  };
  const when = (o: Pick<WaitlistOffer, "date" | "start">) => `${formatDayShort(o.date)} ${formatTime(o.start)}`;
  const pending = state.waitlistGaps.filter((g) => !active.some((o) => o.gapId === g.id));
  const history = state.waitlistOffers.filter((o) => o.status !== "offered").reverse();
  const entries = [...state.waitlistEntries].sort(queueOrder);
  const rules = state.waitlistRules;
  const sending = rules.mode !== "off" && !rules.paused;

  const offer = async (gapId: string, opening?: { date: string; staffId: StaffId }) => {
    if (!await withBookingLock(() => dispatch({ type: "waitlist/offer", gapId, opening }))) showToast(t("booking.visitChanged"));
  };

  return (
    <MorePage title={t("features.waitlist")} subtitle={t("offers.subtitle")} module="waitlist" parent={{ href: "/studio/customers", label: t("customers.title") }}>
      <div className="space-y-8">
        <OfferSettings state={state} />

        {active.length > 0 && (
          <Section title={t("offers.active")}>
            <Card className="divide-y divide-hairline">
              {active.map((o) => (
                <ListRow
                  key={o.id}
                  href={offerLink(state.salon.slug, o.id)}
                  aria-label={`${t("offers.openLink")}: ${name(o.customerId)}`}
                  title={name(o.customerId)}
                  meta={`${findService(state, o.serviceId)?.name ?? ""} · ${when(o)} · ${t("offers.countdown", { time: countdown(o.expiresAt - now) })}`}
                  trailing={<DemoBadge short />}
                />
              ))}
            </Card>
          </Section>
        )}

        {pending.length > 0 && (
          <Section title={t("offers.pending")}>
            <Card className="divide-y divide-hairline">
              {pending.map((gap) => {
                const match = nextMatch(state, gap, now);
                const person = state.staff.find((s) => s.id === gap.staffId)?.firstName ?? "";
                return (
                  <ListRow
                    key={gap.id}
                    title={`${formatDayShort(gap.date)} ${formatTime(gap.start)}–${formatTime(gap.end)} · ${person}`}
                    meta={[match && t("offers.nextInLine", { name: name(match.entry.customerId), service: match.service.name }), gap.readyAt && t("offers.queued")].filter(Boolean).join(" · ") || undefined}
                    trailing={<Button size="sm" variant="secondary" disabled={!match || !sending} onClick={() => offer(gap.id)}>{t("offers.manual")}</Button>}
                  />
                );
              })}
            </Card>
          </Section>
        )}

        {sending && entries.some((e) => e.serviceId) && <ManualOffer state={state} now={now} onOffer={offer} />}

        <Section title={t("offers.entries")}>
          {entries.length ? (
            <Card className="divide-y divide-hairline">
              {entries.map((entry) => <ListRow key={entry.id} title={name(entry.customerId)} meta={entrySummary(state, entry)} />)}
            </Card>
          ) : (
            <EmptyState icon={<BellRing size={22} />} title={t("offers.empty.title")} text={t("offers.empty.text")} />
          )}
        </Section>

        {history.length > 0 && <History state={state} offers={history} name={name} when={when} />}
      </div>
    </MorePage>
  );
}

function History({ state, offers, name, when }: { state: DemoState; offers: WaitlistOffer[]; name: (id: string) => string; when: (o: WaitlistOffer) => string }) {
  return (
    <Section title={t("offers.history")}>
      <Card className="divide-y divide-hairline">
        {offers.map((o) => (
          <ListRow
            key={o.id}
            title={name(o.customerId)}
            meta={`${findService(state, o.serviceId)?.name ?? ""} · ${when(o)}`}
            trailing={<Badge tone={STATUS_TONE[o.status]}>{t(`offers.status.${o.status}`)}</Badge>}
          />
        ))}
      </Card>
    </Section>
  );
}
