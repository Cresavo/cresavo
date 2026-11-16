"use client";

import { useState } from "react";
import { CalendarHeart, Check, Megaphone } from "lucide-react";
import { addDays, diffDays } from "@/concept/data/dates";
import type { Campaign, CampaignStatus, Holiday } from "@/concept/data/types";
import { t, tc } from "@/concept/i18n";
import { formatDate, formatDayLong, formatNumber } from "@/concept/i18n/format";
import { findService } from "@/concept/selectors";
import { dispatch, undo } from "@/concept/store";
import { MorePage } from "@/concept/studio/more/more-page";
import { Poster, type PosterStyle } from "@/concept/studio/more/poster";
import { useStudio } from "@/concept/studio/use-studio";
import { Badge } from "@/concept/ui/badge";
import { Button } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { Segmented } from "@/concept/ui/controls";
import { EmptyState } from "@/concept/ui/empty-state";
import { showToast } from "@/concept/ui/toast";

const HOLIDAYS_SHOWN = 6;
const HOLIDAY_DISCOUNT = 15;
const STATUS_TONE: Record<CampaignStatus, "accent" | "neutral" | "warn"> = { active: "accent", planned: "warn", draft: "neutral", ended: "neutral" };

export default function CampaignsPage() {
  const { state, today } = useStudio();
  const [style, setStyle] = useState<PosterStyle>("calm");
  const holidays = state.holidays.slice(0, HOLIDAYS_SHOWN);
  const next = holidays[0];
  const planned = new Set(state.campaigns.map((c) => c.holidayId));

  const createFor = (holiday: Holiday) => {
    dispatch({
      type: "campaign/create",
      campaign: {
        name: t("campaigns.holidayName", { name: holiday.name }),
        serviceIds: holiday.serviceIds,
        discountPercent: HOLIDAY_DISCOUNT,
        from: diffDays(holiday.date, today) > holiday.leadDays ? addDays(holiday.date, -holiday.leadDays) : today,
        to: holiday.date,
        status: "planned",
        channels: ["Instagram", "Facebook", "Newsletter"],
        holidayId: holiday.id,
      },
    });
    showToast(t("campaigns.created", { name: holiday.name }), { label: t("common.undo"), run: undo });
  };

  return (
    <MorePage title={t("nav.campaigns")} subtitle={t("campaigns.subtitle")} module="campaigns">
      <div className="space-y-8">
        <Section title={t("campaigns.yours")}>
          {state.campaigns.length ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {state.campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
            </div>
          ) : (
            <EmptyState icon={<Megaphone size={22} />} title={t("campaigns.none")} />
          )}
        </Section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Section title={t("campaigns.calendar")}>
            <Card className="divide-y divide-eko-line overflow-hidden">
              {holidays.map((h) => {
                const days = diffDays(h.date, today);
                return (
                  <div key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                    <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-eko-accent-soft text-eko-accent">
                      <span className="text-[11px] font-semibold uppercase leading-none">{formatDate(h.date).split(" ")[1]}</span>
                      <span className="text-lg font-semibold leading-tight">{formatDate(h.date).split(" ")[0]}</span>
                    </span>
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="font-medium">
                        {h.name} <span className="text-sm font-normal text-eko-muted">· {tc("campaigns.daysLeft", days)}</span>
                      </p>
                      <p className="text-sm text-eko-muted">{h.idea}</p>
                    </div>
                    {planned.has(h.id) ? (
                      <Badge tone="accent"><Check size={12} />{t("campaigns.planned")}</Badge>
                    ) : (
                      <Button size="sm" variant="secondary" icon={<CalendarHeart size={16} />} onClick={() => createFor(h)}>
                        {t("campaigns.create")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </Card>
          </Section>

          {next && (
            <Section title={t("campaigns.posterTitle", { name: next.name })}>
              <div className="space-y-3">
                <Segmented<PosterStyle>
                  label={t("campaigns.posterStyle")}
                  value={style}
                  onChange={setStyle}
                  className="w-full"
                  options={[
                    { value: "calm", label: t("campaigns.style.calm") },
                    { value: "bold", label: t("campaigns.style.bold") },
                    { value: "photo", label: t("campaigns.style.photo") },
                  ]}
                />
                <Poster
                  holiday={next}
                  salon={state.salon}
                  style={style}
                  offer={t("campaigns.posterOffer", { percent: HOLIDAY_DISCOUNT })}
                  detail={findService(state, next.serviceIds[0])?.name ?? ""}
                />
                <p className="text-xs text-eko-muted">{t("campaigns.posterNote")}</p>
              </div>
            </Section>
          )}
        </div>
      </div>
    </MorePage>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { state } = useStudio();
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{campaign.name}</p>
          <p className="text-sm text-eko-muted">
            {formatDayLong(campaign.from)} – {formatDayLong(campaign.to)}
          </p>
        </div>
        <Badge tone={STATUS_TONE[campaign.status]}>{t(`campaigns.status.${campaign.status}`)}</Badge>
      </div>
      <p className="text-sm">
        {t("format.percent", { value: campaign.discountPercent })} · {campaign.serviceIds.map((id) => findService(state, id)?.name).join(", ")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {campaign.channels.map((ch) => <Badge key={ch}>{ch}</Badge>)}
      </div>
      {campaign.stats && (
        <div className="grid grid-cols-3 gap-2 border-t border-eko-line pt-3 text-sm">
          <Stat label={t("campaigns.reach")} value={formatNumber(campaign.stats.reach)} />
          <Stat label={t("campaigns.clicks")} value={formatNumber(campaign.stats.clicks)} />
          <Stat label={t("campaigns.bookings")} value={formatNumber(campaign.stats.bookings)} />
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-eko-muted">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
