"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { nextMatch, queueOrder } from "../../booking/waitlist-match";
import { offerLink } from "../../booking/waitlist-offer";
import type { WaitlistOffer } from "../../booking/waitlist-types";
import type { DemoState, StaffId } from "../../data/types";
import { t } from "../../i18n";
import { formatDayShort, formatTime } from "../../i18n/format";
import { findCustomer, findService, fullName } from "../../selectors";
import { dispatch, hasCrossTabLock, withBookingLock } from "../../store";
import { Notice } from "../../ui/notice";
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

/** The start of the current minute, checked every 15 seconds: matching previews change at most once a minute. */
function useMinute() {
  const minute = () => Math.floor(Date.now() / 60_000) * 60_000;
  const [now, setNow] = useState(minute);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(minute()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

const countdown = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** Time left on one offer. Only this text renders every second, never the matching around it. */
export function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <>{t("offers.countdown", { time: countdown(until - now) })}</>;
}

const STATUS_TONE = { offered: "accent", claimed: "accent", lapsed: "neutral", declined: "neutral" } as const;

/** Customers > Waiting list: who waits, which freed times are ready to offer, offers out now and earlier ones. */
export function WaitlistPage() {
  const { state } = useStudio();
  const active = state.waitlistOffers.filter((o) => o.status === "offered");
  const now = useMinute();
  const name = (id: string) => {
    const customer = findCustomer(state, id);
    return customer ? fullName(customer) : t("log.someone");
  };
  const when = (o: Pick<WaitlistOffer, "date" | "start">) => `${formatDayShort(o.date)} ${formatTime(o.start)}`;
  const pending = state.waitlistGaps.filter((g) => !active.some((o) => o.gapId === g.id));
  // Who is next for each pending time: worked out again only when the salon changes or a minute passes.
  const matches = useMemo(() => new Map(state.waitlistGaps.map((gap) => [gap.id, nextMatch(state, gap, now)])), [state, now]);
  const history = state.waitlistOffers.filter((o) => o.status !== "offered").reverse();
  const entries = [...state.waitlistEntries].sort(queueOrder);
  const rules = state.waitlistRules;
  const sending = rules.mode !== "off" && !rules.paused;

  const offer = async (gapId: string, opening?: { date: string; staffId: StaffId }) => {
    if (!await withBookingLock(() => dispatch({ type: "waitlist/offer", gapId, opening })).catch(() => false)) showToast(t("booking.visitChanged"));
  };

  return (
    <MorePage title={t("features.waitlist")} subtitle={t("offers.subtitle")} module="waitlist" parent={{ href: "/studio/customers", label: t("customers.title") }}>
      <div className="space-y-8">
        {!hasCrossTabLock() && <Notice tone="warning">{t("offers.noLock")}</Notice>}
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
                  meta={<>{findService(state, o.serviceId)?.name ?? ""} · {when(o)} · <Countdown until={o.expiresAt} /></>}
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
                const match = matches.get(gap.id);
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
