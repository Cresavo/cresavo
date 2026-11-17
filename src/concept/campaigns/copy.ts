import { writePostTask } from "../ai/tasks/write-post";
import type { Channel, DateKey } from "../data/types";
import { t, tc } from "../i18n";
import { formatDate } from "../i18n/format";
import { assembleCopy } from "./channels";

const NAMED_SERVICES = 2;

interface OfferInput {
  name: string;
  serviceNames: string[];
  discountPercent: number;
  to: DateKey;
}

/** "Deep tissue massage and Classic massage", or "Classic massage and 2 more". */
export function listServices(names: string[]): string {
  if (names.length <= NAMED_SERVICES) return names.join(t("campaigns.and"));
  return `${names[0]}${t("campaigns.and")}${tc("campaigns.more", names.length - 1)}`;
}

/** One plain sentence for the writer: what is offered and until when. */
export function offerText({ name, serviceNames, discountPercent, to }: OfferInput): string {
  const key = discountPercent > 0 ? "campaigns.offer.line" : "campaigns.offer.lineNoDiscount";
  return t(key, { name, percent: discountPercent, services: listServices(serviceNames), date: formatDate(to) });
}

/** The channel text without any AI: the task's rule-based draft plus link and hashtags. */
export function rulesCopy(channel: Channel, offer: string, link: string): string {
  const draft = writePostTask.fallback({ offer, channel });
  return assembleCopy(channel, draft.text, draft.hashtags, link);
}
