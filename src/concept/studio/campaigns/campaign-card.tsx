import Link from "next/link";
import { CalendarClock } from "lucide-react";
import type { Campaign, CampaignStatus } from "../../data/types";
import { t } from "../../i18n";
import { formatDate } from "../../i18n/format";
import { findService } from "../../selectors";
import { Badge } from "../../ui/badge";
import { Card } from "../../ui/card";
import { useStudio } from "../use-studio";
import { StatRow } from "./campaign-stats";

export const STATUS_TONE: Record<CampaignStatus, "accent" | "neutral" | "warn"> = { active: "accent", planned: "warn", draft: "neutral", ended: "neutral" };

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { state } = useStudio();
  return (
    <Link href={`/studio/more/campaigns/${campaign.id}`} className="block rounded-lg focus-visible:outline-offset-2">
      <Card className="h-full space-y-3 p-4 transition-colors hover:bg-surface-2/50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">{campaign.name}</p>
            <p className="text-sm text-text-secondary">
              {formatDate(campaign.from)} – {formatDate(campaign.to)}
            </p>
          </div>
          <Badge tone={STATUS_TONE[campaign.status]}>{t(`campaigns.status.${campaign.status}`)}</Badge>
        </div>
        <p className="text-sm">
          {campaign.discountPercent > 0 && `${t("format.percent", { value: campaign.discountPercent })} · `}
          {campaign.serviceIds.map((id) => findService(state, id)?.name).join(", ")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {campaign.channels.map((channel) => <Badge key={channel}>{t(`channel.${channel}`)}</Badge>)}
        </div>
        {campaign.stats ? (
          <div className="border-t border-border pt-3"><StatRow stats={campaign.stats} /></div>
        ) : (
          campaign.publishOn && (
            <p className="flex items-center gap-1.5 border-t border-border pt-3 text-sm text-text-secondary">
              <CalendarClock size={15} />
              {t("campaigns.scheduledFor", { day: formatDate(campaign.publishOn) })}
            </p>
          )
        )}
      </Card>
    </Link>
  );
}
