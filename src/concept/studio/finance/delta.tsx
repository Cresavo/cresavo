import { t } from "../../i18n";
import { formatNumber } from "../../i18n/format";
import { changeShare } from "../../finance/overview";
import { Badge } from "../../ui/badge";

interface DeltaProps {
  current: number;
  previous: number;
  /** Show the difference as a number of items instead of a percentage. */
  count?: boolean;
  /** For things like cancellations, where fewer is better. */
  lowerIsBetter?: boolean;
}

/** "+12%" or "−2" next to the figure it belongs to: green when it moved the good way. */
export function Delta({ current, previous, count, lowerIsBetter }: DeltaProps) {
  const diff = count ? current - previous : changeShare(current, previous);
  if (diff === null) return <Badge>{t("finance.noEarlier")}</Badge>;
  const sign = diff < 0 ? "−" : "+";
  const text = count ? `${sign}${formatNumber(Math.abs(diff))}` : `${sign}${t("format.percent", { value: formatNumber(Math.abs(diff) * 100) })}`;
  if (Math.abs(diff) < (count ? 1 : 0.005)) return <Badge>{count ? "0" : text}</Badge>;
  return <Badge tone={diff > 0 !== Boolean(lowerIsBetter) ? "accent" : "warn"}>{text}</Badge>;
}
