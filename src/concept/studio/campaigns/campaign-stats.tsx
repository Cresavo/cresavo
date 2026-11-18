import { reachByChannel } from "../../campaigns/simulate";
import type { Campaign } from "../../data/types";
import { t } from "../../i18n";
import { formatMoney, formatNumber } from "../../i18n/format";
import { BarList } from "../../ui/charts";
import { Card, Section } from "../../ui/card";

/** The four numbers the owner cares about, small enough for a card and large enough for the detail page. */
export function StatRow({ stats, large = false }: { stats: NonNullable<Campaign["stats"]>; large?: boolean }) {
  const items = [
    { label: t("campaigns.reach"), value: formatNumber(stats.reach) },
    { label: t("campaigns.clicks"), value: formatNumber(stats.clicks) },
    { label: t("campaigns.bookings"), value: formatNumber(stats.bookings), strong: true },
    { label: t("campaigns.revenue"), value: formatMoney(stats.revenue), strong: true },
  ];
  return (
    <dl className={large ? "grid grid-cols-2 gap-3 sm:grid-cols-4" : "grid grid-cols-4 gap-2 text-sm"}>
      {items.map((item) => (
        <div key={item.label} className={large ? "rounded-lg bg-surface p-4 ring-1 ring-hairline" : undefined}>
          <dt className="text-xs text-text-secondary">{item.label}</dt>
          <dd className={large ? "mt-1 text-2xl font-semibold tabular-nums" : "font-semibold tabular-nums"}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReachByChannel({ campaign }: { campaign: Campaign }) {
  return (
    <Section title={t("campaigns.reachBy")}>
      <Card className="p-4">
        <BarList
          data={reachByChannel(campaign).map(({ channel, reach }) => ({ id: channel, label: t(`channel.${channel}`), value: reach }))}
          format={formatNumber}
        />
      </Card>
    </Section>
  );
}
