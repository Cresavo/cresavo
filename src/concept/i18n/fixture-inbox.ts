import type { Locale } from "@/lib/locale";
import type { DemoState, InboxItem } from "../data/types";
import { translate } from ".";
import { customerText } from "./customer-text";
import { formatDayLong, formatMoney, formatTime } from "./format";

function fixtureMessage(state: DemoState, item: InboxItem, language: Locale) {
  const time = item.title.match(/\d{1,2}:\d{2}/)?.[0];
  const name = state.customers.find((customer) => customer.id === item.customerId)?.firstName;
  const businessLanguage = state.localization.language;
  const suggestion = item.suggestion && {
    day: formatDayLong(item.suggestion.date, businessLanguage),
    time: formatTime(item.suggestion.start, businessLanguage),
  };

  switch (item.id) {
    case "i-omdome-5":
    case "i-omdome-3": {
      const happy = item.id === "i-omdome-5";
      return {
        title: translate(language, "fixture.inbox.reviewTitle", { stars: happy ? "★★★★★" : "★★★☆☆" }),
        body: translate(language, happy ? "fixture.eko.review.happy" : "fixture.eko.review.meh"),
        draftReply: name && customerText(state, happy ? "reviews.draftHappy" : "reviews.draftUnhappy", { name }),
      };
    }
    case "i-avbokning":
      return {
        title: time ? translate(language, "fixture.inbox.cancelTitle", { time }) : item.title,
        body: translate(language, "fixture.inbox.cancelBody"),
        draftReply: name && customerText(state, "fixture.reply.cancel", { name }),
      };
    case "i-forfragan":
      return {
        title: translate(language, "fixture.inbox.requestTitle"),
        body: name ? `${translate(language, "fixture.eko.inbox.returning")} /${name}` : item.body,
        draftReply: name && suggestion && customerText(state, "fixture.reply.booking", { name, ...suggestion }),
      };
    case "i-ombokning":
      return {
        title: translate(language, "fixture.inbox.moveTitle"),
        body: translate(language, "fixture.inbox.moveBody"),
        draftReply: name && suggestion && customerText(state, "fixture.reply.move", { name, ...suggestion }),
      };
    case "i-presentkort":
      return {
        title: translate(language, "fixture.inbox.giftTitle"),
        body: translate(language, "fixture.eko.inbox.gift"),
        draftReply: customerText(state, "fixture.reply.gift", { price: formatMoney(450, state.localization.currency, businessLanguage) }),
      };
    case "i-nykund":
      return {
        title: translate(language, "fixture.inbox.newTitle"),
        body: translate(language, "fixture.eko.inbox.new"),
        draftReply: customerText(state, "fixture.eko.inbox.newReply"),
      };
    case "i-paminnelser": {
      const count = item.body.match(/^\d+/)?.[0];
      return {
        title: translate(language, "fixture.inbox.remindersTitle"),
        body: count === undefined ? item.body : translate(language, "fixture.inbox.remindersBody", { count }),
      };
    }
    default:
      return undefined;
  }
}

/** Translate seeded incoming messages for the studio and draft their replies for the recipient. */
export function fixtureInboxCopy(state: DemoState, language: Locale): InboxItem[] {
  return state.inbox.map((item) => {
    const copy = fixtureMessage(state, item, language);
    if (!copy) return item;
    return { ...item, ...copy, draftReply: item.handled ? item.draftReply : copy.draftReply ?? item.draftReply };
  });
}
