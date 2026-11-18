import { Clock, Mail, MapPin, Phone, Star } from "lucide-react";
import { formatTime, weekday } from "../data/dates";
import type { DemoState, Review } from "../data/types";
import { t, words } from "../i18n";
import { formatDate } from "../i18n/format";
import { Card, Section } from "../ui/card";
import { cx } from "../ui/cx";
import type { Now } from "../use-now";
import { publicName, recentReviews, reviewSummary } from "./reviews";

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function OpeningHours({ state, now }: { state: DemoState; now: Now }) {
  const todayIndex = weekday(now.today);
  return (
    <Section title={t("booking.hours")}>
      <Card className="divide-y divide-hairline">
        {WEEK_ORDER.map((day) => {
          const hours = state.salon.hours[day];
          return (
            <div key={day} className={cx("flex items-center justify-between px-4 py-2.5 text-sm", day === todayIndex && "font-semibold")}>
              <span>{words.weekdays[day]}</span>
              <span className={hours ? "" : "text-text-secondary"}>{hours ? `${formatTime(hours.open)}–${formatTime(hours.close)}` : t("booking.closed")}</span>
            </div>
          );
        })}
      </Card>
    </Section>
  );
}

export function FindUs({ state }: { state: DemoState }) {
  const mapLink = `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${state.salon.address}, ${state.salon.area.split(" · ")[0]}`)}`;
  const { salon } = state;
  const rows = [
    { icon: MapPin, text: `${salon.address}, ${salon.area}` },
    { icon: Phone, text: salon.phone },
    { icon: Mail, text: salon.email },
    ...(salon.lunch ? [{ icon: Clock, text: t("booking.lunchNote", { from: formatTime(salon.lunch.start), to: formatTime(salon.lunch.end) }) }] : []),
  ];
  return (
    <Section title={t("booking.findUs")}>
      <Card className="space-y-3 p-4 text-sm">
        {rows.map(({ icon: Icon, text }) => (
          <p key={text} className="flex items-start gap-3">
            <Icon size={16} className="mt-0.5 shrink-0 text-text-secondary" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
          </p>
        ))}
        <a href={mapLink} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center font-medium text-action underline-offset-2 hover:underline">
          {t("booking.openMap")}
        </a>
      </Card>
    </Section>
  );
}

export function Reviews({ state, variant = "cards" }: { state: DemoState; variant?: string }) {
  const shown = recentReviews(state.reviews, variant === "quote" ? 1 : 3);
  if (variant === "quote" && shown[0]) return <QuoteReview state={state} review={shown[0]} />;
  return (
    <Section title={t("booking.reviews")}>
      <div className="space-y-3">
        {shown.map((review) => {
          const customer = state.customers.find((c) => c.id === review.customerId);
          return (
            <Card key={review.id} className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span role="img" className="flex items-center gap-0.5" aria-label={t("booking.stars", { count: review.rating })}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={14} className={n <= review.rating ? "fill-amber-400 text-amber-400" : "text-border"} />
                  ))}
                </span>
                <span className="text-text-secondary">{formatDate(review.date)}</span>
              </div>
              <p className="text-[15px] leading-relaxed">{review.text}</p>
              <p className="text-xs text-text-secondary">{customer ? publicName(customer.firstName, customer.lastName) : ""} · {review.source}</p>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

/** One review, large, with the average beside it. */
function QuoteReview({ state, review }: { state: DemoState; review: Review }) {
  const { average, count } = reviewSummary(state.reviews);
  const customer = state.customers.find((c) => c.id === review.customerId);
  return (
    <Section title={t("booking.reviews")}>
      <Card className="space-y-3 p-6 text-center">
        <p className="text-xl font-medium leading-snug sm:text-2xl">“{review.text}”</p>
        <p className="text-sm text-text-secondary">
          {customer ? publicName(customer.firstName, customer.lastName) : ""} · {t("booking.reviewsAverage", { average: average.toFixed(1), count })}
        </p>
      </Card>
    </Section>
  );
}
