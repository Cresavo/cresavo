import { Clock, Mail, MapPin, Phone, Star } from "lucide-react";
import { formatTime, weekday } from "../data/dates";
import type { DemoState } from "../data/types";
import { t, words } from "../i18n";
import { formatDate } from "../i18n/format";
import { Card, Section } from "../ui/card";
import { cx } from "../ui/cx";
import type { Now } from "../use-now";
import { publicName, recentReviews } from "./reviews";

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function OpeningHours({ state, now }: { state: DemoState; now: Now }) {
  const todayIndex = weekday(now.today);
  return (
    <Section title={t("booking.hours")}>
      <Card className="divide-y divide-eko-line">
        {WEEK_ORDER.map((day) => {
          const hours = state.salon.hours[day];
          return (
            <div key={day} className={cx("flex items-center justify-between px-4 py-2.5 text-sm", day === todayIndex && "font-semibold")}>
              <span>{words.weekdays[day]}</span>
              <span className={hours ? "" : "text-eko-muted"}>{hours ? `${formatTime(hours.open)}–${formatTime(hours.close)}` : t("booking.closed")}</span>
            </div>
          );
        })}
      </Card>
    </Section>
  );
}

export function FindUs({ state }: { state: DemoState }) {
  const { salon } = state;
  const rows = [
    { icon: MapPin, text: `${salon.address}, ${salon.area}` },
    { icon: Phone, text: salon.phone },
    { icon: Mail, text: salon.email },
    { icon: Clock, text: t("booking.lunchNote", { from: formatTime(salon.lunch.start), to: formatTime(salon.lunch.end) }) },
  ];
  return (
    <Section title={t("booking.findUs")}>
      <Card className="space-y-3 p-4 text-sm">
        {rows.map(({ icon: Icon, text }) => (
          <p key={text} className="flex items-start gap-3">
            <Icon size={16} className="mt-0.5 shrink-0 text-eko-muted" />
            <span>{text}</span>
          </p>
        ))}
      </Card>
    </Section>
  );
}

export function Reviews({ state }: { state: DemoState }) {
  const shown = recentReviews(state.reviews, 3);
  return (
    <Section title={t("booking.reviews")}>
      <div className="space-y-3">
        {shown.map((review) => {
          const customer = state.customers.find((c) => c.id === review.customerId);
          return (
            <Card key={review.id} className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-0.5" aria-label={t("booking.stars", { count: review.rating })}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={14} className={n <= review.rating ? "fill-amber-400 text-amber-400" : "text-eko-line"} />
                  ))}
                </span>
                <span className="text-eko-muted">{formatDate(review.date)}</span>
              </div>
              <p className="text-[15px] leading-relaxed">{review.text}</p>
              <p className="text-xs text-eko-muted">{customer ? publicName(customer.firstName, customer.lastName) : ""} · {review.source}</p>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
