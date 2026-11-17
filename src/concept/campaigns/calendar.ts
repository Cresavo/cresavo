import { addDays, diffDays, fromKey, startOfWeek, toKey } from "../data/dates";
import type { Campaign, Channel, DateKey, Holiday } from "../data/types";

export interface CalendarPost {
  campaignId: string;
  name: string;
  channels: Channel[];
  planned: boolean;
}

export interface CalendarDay {
  date: DateKey;
  inMonth: boolean;
  holidays: Holiday[];
  posts: CalendarPost[];
}

/** The day a campaign's posts go out. Older campaigns without a stored day used their start day. */
export function postDay(campaign: Campaign): DateKey {
  return campaign.publishOn ?? campaign.from;
}

/** Whole weeks (Monday first) that cover a month, with holidays and posts on each day. */
export function monthGrid(month: string, holidays: Holiday[], campaigns: Campaign[]): CalendarDay[][] {
  const first: DateKey = `${month}-01`;
  const last = toKey(new Date(fromKey(first).getFullYear(), fromKey(first).getMonth() + 1, 0, 12));
  const start = startOfWeek(first);
  const weeks = Math.ceil((diffDays(last, start) + 1) / 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      return {
        date,
        inMonth: date.slice(0, 7) === month,
        holidays: holidays.filter((h) => h.date === date),
        posts: campaigns
          .filter((c) => postDay(c) === date)
          .map((c) => ({ campaignId: c.id, name: c.name, channels: c.channels, planned: c.status === "planned" })),
      };
    }),
  );
}

export function shiftMonth(month: string, delta: number): string {
  const d = fromKey(`${month}-01`);
  return toKey(new Date(d.getFullYear(), d.getMonth() + delta, 1, 12)).slice(0, 7);
}
