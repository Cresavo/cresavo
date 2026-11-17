import { useState } from "react";
import { AD_BUDGETS, AD_DAYS, AD_RADII_KM, estimateAd } from "../../campaigns/simulate";
import type { Campaign, CampaignAd } from "../../data/types";
import { t, tc } from "../../i18n";
import { formatMoney, formatNumber } from "../../i18n/format";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { Segmented } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";

interface AdSheetProps {
  campaign: Campaign;
  area: string;
  open: boolean;
  onClose: () => void;
}

const DEFAULT_AD: CampaignAd = { budget: 500, days: 7, radiusKm: 5 };

/** "Run as ad": budget, days and local area, with what that is expected to reach. Simulated. */
export function AdSheet({ campaign, area, open, onClose }: AdSheetProps) {
  const [ad, setAd] = useState<CampaignAd>(DEFAULT_AD);
  const estimate = estimateAd(ad);

  const start = () => {
    if (dispatch({ type: "campaign/ad", id: campaign.id, ad })) showToast(t("campaigns.ad.started", { name: campaign.name }), { label: t("common.undo"), run: undo });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("campaigns.ad.title")}
      description={t("campaigns.ad.subtitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={start}>{t("campaigns.ad.start", { budget: formatMoney(ad.budget) })}</Button>
        </>
      }
    >
      <div className="space-y-5 pt-2">
        <Choice label={t("campaigns.ad.budget")}>
          <Segmented<string>
            label={t("campaigns.ad.budget")}
            className="w-full"
            value={String(ad.budget)}
            onChange={(value) => setAd({ ...ad, budget: Number(value) })}
            options={AD_BUDGETS.map((budget) => ({ value: String(budget), label: formatMoney(budget) }))}
          />
        </Choice>
        <Choice label={t("campaigns.ad.days")}>
          <Segmented<string>
            label={t("campaigns.ad.days")}
            className="w-full"
            value={String(ad.days)}
            onChange={(value) => setAd({ ...ad, days: Number(value) })}
            options={AD_DAYS.map((days) => ({ value: String(days), label: tc("campaigns.ad.daysOption", days) }))}
          />
        </Choice>
        <Choice label={t("campaigns.ad.area")}>
          <Segmented<string>
            label={t("campaigns.ad.area")}
            className="w-full"
            value={String(ad.radiusKm)}
            onChange={(value) => setAd({ ...ad, radiusKm: Number(value) })}
            options={AD_RADII_KM.map((km) => ({ value: String(km), label: t("campaigns.ad.km", { km }) }))}
          />
          <p className="text-sm text-eko-muted">{t("campaigns.ad.audience", { km: ad.radiusKm, area })}</p>
        </Choice>
        <div className="space-y-1 rounded-2xl bg-eko-accent-soft p-4 text-eko-accent">
          <p className="text-xs font-semibold uppercase tracking-wide">{t("campaigns.ad.estimate")}</p>
          <p className="text-xl font-semibold tabular-nums">
            {t("campaigns.ad.reach", { low: formatNumber(estimate.reachLow), high: formatNumber(estimate.reachHigh) })}
          </p>
          <p className="text-sm">{t("campaigns.ad.clicksBookings", { clicks: formatNumber(estimate.clicks), bookings: formatNumber(estimate.bookings) })}</p>
        </div>
        <p className="text-xs text-eko-muted">{t("campaigns.ad.note")}</p>
      </div>
    </Sheet>
  );
}

function Choice({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}
