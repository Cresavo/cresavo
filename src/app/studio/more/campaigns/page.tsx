"use client";

import Link from "next/link";
import { CalendarHeart, Check, Megaphone, Plus } from "lucide-react";
import { prefillForHoliday, studioHref } from "@/concept/campaigns/prefill";
import { diffDays } from "@/concept/data/dates";
import { t, tc } from "@/concept/i18n";
import { formatDate } from "@/concept/i18n/format";
import { MorePage } from "@/concept/studio/more/more-page";
import { CampaignCard } from "@/concept/studio/campaigns/campaign-card";
import { ContentCalendar } from "@/concept/studio/campaigns/content-calendar";
import { useStudio } from "@/concept/studio/use-studio";
import { Badge } from "@/concept/ui/badge";
import { ButtonLink } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { EmptyState } from "@/concept/ui/empty-state";

const HOLIDAYS_SHOWN = 6;

export default function CampaignsPage() {
  const { state, today } = useStudio();
  const planned = new Set(state.campaigns.map((c) => c.holidayId));

  return (
    <MorePage
      title={t("nav.campaigns")}
      subtitle={t("campaigns.subtitle")}
      module="campaigns"
      actions={<ButtonLink href="/studio/more/campaigns/new" icon={<Plus size={18} />}>{t("campaigns.new")}</ButtonLink>}
    >
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

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Section title={t("campaigns.calendar")}>
            <ContentCalendar />
          </Section>
          <Section title={t("campaigns.holidays")}>
            <Card className="divide-y divide-eko-line overflow-hidden">
              {state.holidays.slice(0, HOLIDAYS_SHOWN).map((h) => (
                <div key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                  <CalendarHeart size={18} className="shrink-0 text-eko-accent" />
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="font-medium">{h.name}</p>
                    <p className="text-sm text-eko-muted">
                      {formatDate(h.date)} · {tc("campaigns.daysLeft", diffDays(h.date, today))}
                    </p>
                  </div>
                  {planned.has(h.id) ? (
                    <Badge tone="accent"><Check size={12} />{t("campaigns.planned")}</Badge>
                  ) : (
                    <Link href={studioHref(prefillForHoliday(state, h, today), true)} className="text-sm font-medium text-eko-accent hover:underline">
                      {t("campaigns.create")}
                    </Link>
                  )}
                </div>
              ))}
            </Card>
          </Section>
        </div>
      </div>
    </MorePage>
  );
}
