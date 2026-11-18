import type { Adapter, CountryCode, Money, PortResult, UtcTimestamp } from "../core";

export type AdsCapability = "campaign-draft";

export interface AdCampaignDraft {
  name: string;
  objective: "traffic" | "awareness";
  dailyBudget: Money;
  start: UtcTimestamp;
  end: UtcTimestamp;
  country: CountryCode;
  radiusKm: number;
  reference: string;
}

export interface AdDraftReceipt {
  draftId: string;
  /** Drafts are always created paused; going live stays a human step in the provider's own UI. */
  state: "paused";
}

export interface AdsPort extends Adapter<AdsCapability> {
  createDraft(draft: AdCampaignDraft): Promise<PortResult<AdDraftReceipt>>;
}
