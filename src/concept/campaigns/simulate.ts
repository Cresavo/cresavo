import type { Campaign, CampaignAd, CampaignStats, Channel } from "../data/types";
import { CHANNELS } from "./channels";

// Everything here is invented but deterministic: the same campaign always
// shows the same numbers, so screenshots and tests are stable.

/** People reached on a typical first week, per channel. */
const CHANNEL_REACH: Record<Channel, number> = { instagram: 620, facebook: 430, tiktok: 760, newsletter: 380, sms: 240 };
const CLICK_RATE: Record<Channel, number> = { instagram: 0.06, facebook: 0.055, tiktok: 0.04, newsletter: 0.14, sms: 0.2 };

function jitter(seed: string): number {
  let hash = 7;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) % 1000;
  return 0.9 + (hash / 1000) * 0.2;
}

interface SimulationInput {
  seed: string;
  channels: Channel[];
  discountPercent: number;
  /** Average full price of the campaign's treatments. */
  avgPrice: number;
}

/** First-week results of a campaign without ads. */
export function simulateStats({ seed, channels, discountPercent, avgPrice }: SimulationInput): CampaignStats {
  const factor = jitter(seed);
  let reach = 0;
  let clicks = 0;
  for (const channel of channels) {
    const channelReach = CHANNEL_REACH[channel] * factor;
    reach += channelReach;
    clicks += channelReach * CLICK_RATE[channel];
  }
  const bookingRate = 0.1 + Math.min(discountPercent, 30) * 0.003;
  const bookings = clicks > 0 ? Math.max(1, Math.round(clicks * bookingRate)) : 0;
  return {
    reach: Math.round(reach),
    clicks: Math.round(clicks),
    bookings,
    revenue: Math.round(bookings * avgPrice * (1 - discountPercent / 100)),
  };
}

/** Reach split over the channels the campaign used (the stored stats are totals). */
export function reachByChannel(campaign: Pick<Campaign, "channels" | "stats">): { channel: Channel; reach: number }[] {
  const channels = CHANNELS.filter((c) => campaign.channels.includes(c));
  const weight = channels.reduce((sum, c) => sum + CHANNEL_REACH[c], 0);
  const total = campaign.stats?.reach ?? 0;
  return channels.map((channel) => ({ channel, reach: Math.round((total * CHANNEL_REACH[channel]) / (weight || 1)) }));
}

export const AD_BUDGETS = [200, 500, 1000, 2000];
export const AD_DAYS = [3, 7, 14];
export const AD_RADII_KM = [3, 5, 10, 25];

export interface AdEstimate {
  reachLow: number;
  reachHigh: number;
  clicks: number;
  bookings: number;
}

const SPREAD = 0.2;

/** What a budget is expected to buy: wider areas are cheaper per person, longer runs reach more different people. */
export function estimateAd({ budget, days, radiusKm }: CampaignAd): AdEstimate {
  const costPerThousand = 70 - Math.min(radiusKm, 25) * 1.2;
  const unique = 0.55 + 0.05 * Math.min(days, 10);
  const reach = (budget / costPerThousand) * 1000 * unique;
  const clicks = reach * 0.012;
  return {
    reachLow: Math.round((reach * (1 - SPREAD)) / 10) * 10,
    reachHigh: Math.round((reach * (1 + SPREAD)) / 10) * 10,
    clicks: Math.round(clicks),
    bookings: Math.max(1, Math.round(clicks * 0.08)),
  };
}

/** Adds the middle of an ad estimate to a campaign's results. */
export function addAdResults(stats: CampaignStats, ad: CampaignAd, avgPrice: number, discountPercent: number): CampaignStats {
  const estimate = estimateAd(ad);
  const bookings = stats.bookings + estimate.bookings;
  return {
    reach: stats.reach + Math.round((estimate.reachLow + estimate.reachHigh) / 2),
    clicks: stats.clicks + estimate.clicks,
    bookings,
    revenue: stats.revenue + Math.round(estimate.bookings * avgPrice * (1 - discountPercent / 100)),
  };
}
