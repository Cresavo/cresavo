"use client";

import { reviewSummary } from "../../booking/reviews";
import { useRef, useState } from "react";
import { Check, Copy, Download, Megaphone } from "lucide-react";
import { bookedPosterTimes } from "../../campaigns/draft";
import { CHANNELS } from "../../campaigns/channels";
import { downloadBlob, posterToPng } from "../../campaigns/export-png";
import { postDay } from "../../campaigns/calendar";
import type { PosterFormat } from "../../data/types";
import { t, tc } from "../../i18n";
import { formatDate, formatMoney } from "../../i18n/format";
import { findService } from "../../selectors";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Notice } from "../../ui/notice";
import { EmptyState } from "../../ui/empty-state";
import { showToast } from "../../ui/toast";
import { BackLink } from "../back-link";
import { PageHeader } from "../page-header";
import { useStudio } from "../use-studio";
import { AdSheet } from "./ad-sheet";
import { STATUS_TONE } from "./campaign-card";
import { ReachByChannel, StatRow } from "./campaign-stats";
import { PosterView } from "./poster-view";

/** One campaign: how it is doing, the link, the texts and poster that went out, and "Run as ad". */
export function CampaignDetail({ id }: { id: string }) {
  const { state } = useStudio();
  const postSvg = useRef<SVGSVGElement>(null);
  const storySvg = useRef<SVGSVGElement>(null);
  const windowSvg = useRef<SVGSVGElement>(null);
  const [adOpen, setAdOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const campaign = state.campaigns.find((c) => c.id === id);
  const back = <BackLink href="/studio/more/campaigns" label={t("nav.campaigns")} />;

  if (!campaign) {
    return (
      <>
        <PageHeader title={t("campaigns.notFound")} back={back} />
        <EmptyState icon={<Megaphone size={22} />} title={t("campaigns.notFound")} />
      </>
    );
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(campaign.link ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(t("campaigns.copyFailed"));
    }
  };
  const download = async (format: PosterFormat) => {
    const svg = { post: postSvg, story: storySvg, window: windowSvg }[format].current;
    if (!svg) return;
    try {
      downloadBlob(await posterToPng(svg, format), `${campaign.name.replace(/\W+/g, "-").toLowerCase()}-${format}.png`);
    } catch {
      showToast(t("campaigns.poster.failed"));
    }
  };
  const day = postDay(campaign);
  const poster = campaign.poster;
  const stale = poster ? bookedPosterTimes(state, poster, campaign).length > 0 : false;

  return (
    <>
      <PageHeader
        title={campaign.name}
        subtitle={campaign.status === "planned" ? t("campaigns.scheduledFor", { day: formatDate(day) }) : t("campaigns.publishedOn", { day: formatDate(day) })}
        back={back}
        actions={
          campaign.stats && !campaign.ad ? (
            <Button icon={<Megaphone size={18} />} onClick={() => setAdOpen(true)}>{t("campaigns.ad.open")}</Button>
          ) : undefined
        }
      />
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[campaign.status]}>{t(`campaigns.status.${campaign.status}`)}</Badge>
          <span className="text-sm text-text-secondary">
            · {campaign.discountPercent > 0 && `${t("format.percent", { value: campaign.discountPercent })} · `}
            {campaign.serviceIds.map((sid) => findService(state, sid)?.name).join(", ")} · {formatDate(campaign.from)} – {formatDate(campaign.to)}
          </span>
        </div>

        {campaign.link && (
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1 basis-56">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{t("campaigns.link")}</p>
              <p className="truncate font-medium">{campaign.link}</p>
              <p className="text-sm text-text-secondary">{t("campaigns.linkHint")}</p>
            </div>
            <Button variant="secondary" size="sm" icon={copied ? <Check size={16} /> : <Copy size={16} />} onClick={copyLink}>
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
          </Card>
        )}

        {campaign.stats ? (
          <Section title={t("campaigns.results")} action={<Badge>{t("common.simulated")}</Badge>}>
            <StatRow stats={campaign.stats} large />
            {campaign.stats.bookings > 0 && (
              <p className="text-sm text-text-secondary">
                {tc("campaigns.resultsText", campaign.stats.bookings, { revenue: formatMoney(campaign.stats.revenue) })}
              </p>
            )}
          </Section>
        ) : (
          <EmptyState icon={<Megaphone size={22} />} title={t("campaigns.noResults")} text={t("campaigns.noResultsText", { day: formatDate(day) })} />
        )}

        {campaign.ad && (
          <Card className="space-y-1 p-4">
            <p className="font-medium">{t("campaigns.ad.running")}</p>
            <p className="text-sm text-text-secondary">
              {t("campaigns.ad.summary", { budget: formatMoney(campaign.ad.budget), days: campaign.ad.days, km: campaign.ad.radiusKm, area: state.salon.area })}
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {campaign.stats && <ReachByChannel campaign={campaign} />}
          {poster && (
            <Section title={t("campaigns.poster.title")}>
              <div className="space-y-3">
                <div className="mx-auto w-full max-w-xs overflow-hidden rounded-lg">
                  <PosterView ref={postSvg} source={campaign} salon={state.salon} theme={state.page.theme} rating={reviewSummary(state.reviews)} language={state.localization.language} format="post" />
                </div>
                {stale && <Notice tone="warning">{t("campaigns.poster.stale")}</Notice>}
                <div className="flex flex-wrap justify-center gap-2">
                  {(["post", "story", "window"] as const).map((format) => (
                    <Button key={format} size="sm" variant="secondary" icon={<Download size={15} />} onClick={() => void download(format)}>
                      {t(`campaigns.format.${format}`)}
                    </Button>
                  ))}
                </div>
                <div className="hidden">
                  <PosterView ref={storySvg} source={campaign} salon={state.salon} theme={state.page.theme} rating={reviewSummary(state.reviews)} language={state.localization.language} format="story" />
                  <PosterView ref={windowSvg} source={campaign} salon={state.salon} theme={state.page.theme} rating={reviewSummary(state.reviews)} language={state.localization.language} format="window" />
                </div>
              </div>
            </Section>
          )}
        </div>

        {campaign.copy && (
          <Section title={t("campaigns.texts.title")}>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {CHANNELS.filter((c) => campaign.copy?.[c]).map((channel) => (
                <Card key={channel} className="space-y-2 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{t(`channel.${channel}`)}</p>
                  <p className="whitespace-pre-line text-sm">{campaign.copy?.[channel]}</p>
                </Card>
              ))}
            </div>
          </Section>
        )}
      </div>
      <AdSheet campaign={campaign} area={state.salon.area} open={adOpen} onClose={() => setAdOpen(false)} />
    </>
  );
}
