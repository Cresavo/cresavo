import { Mail, MapPin, Phone, Star } from "lucide-react";
import { weekday } from "../data/dates";
import type { DemoState, Review } from "../data/types";
import { t, tc, words } from "../i18n";
import { formatDate, formatTime } from "../i18n/format";
import { Card, Section } from "../ui/card";
import { cx } from "../ui/cx";
import type { Now } from "../use-now";
import { FREE_CHANGE_HOURS } from "./policy";
import { publicName, recentReviews, reviewSummary } from "./reviews";

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** The week at a glance, today in bold, with the lunch break as a note under it. */
export function OpeningHours({ state, now }: { state: DemoState; now: Now }) {
  const todayIndex = weekday(now.today);
  const { lunch } = state.salon;
  return (
    <Section title={t("booking.hours")}>
      <Card className="px-4 py-2">
        <dl className="divide-y divide-hairline text-sm">
          {WEEK_ORDER.map((day) => {
            const hours = state.salon.hours[day];
            return (
              <div key={day} className={cx("flex items-center justify-between py-2", day === todayIndex && "font-semibold")}>
                <dt>{words.weekdays[day]}</dt>
                <dd className={hours ? "tabular-nums" : "text-text-secondary"}>{hours ? `${formatTime(hours.open)}–${formatTime(hours.close)}` : t("booking.closed")}</dd>
              </div>
            );
          })}
        </dl>
        {lunch && <p className="border-t border-hairline py-2 text-sm text-text-secondary">{t("booking.lunchNote", { from: formatTime(lunch.start), to: formatTime(lunch.end) })}</p>}
      </Card>
    </Section>
  );
}

const linkClass = "font-medium text-action underline-offset-2 hover:underline";

/** Address with a plain link to a map (no embed, no third-party script), and how to reach the business. */
export function FindUs({ state }: { state: DemoState }) {
  const { salon } = state;
  const mapLink = `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${salon.address}, ${salon.area.split(" · ")[0]}`)}`;
  return (
    <Section title={t("booking.findUs")}>
      <Card id="find-us" className="scroll-mt-4 divide-y divide-hairline px-4 text-sm">
        <div className="flex items-start gap-3 py-3">
          <MapPin aria-hidden size={16} className="mt-0.5 shrink-0 text-text-secondary" />
          <address className="min-w-0 flex-1 not-italic">
            <span className="block">{salon.address}</span>
            <span className="block text-text-secondary">{salon.area}</span>
            <a href={mapLink} target="_blank" rel="noopener noreferrer" className={cx(linkClass, "mt-1 inline-flex min-h-11 items-center")}>
              {t("booking.openMap")}
            </a>
          </address>
        </div>
        <a href={`tel:${salon.phone.replace(/[^\d+]/g, "")}`} className="flex min-h-12 items-center gap-3">
          <Phone aria-hidden size={16} className="shrink-0 text-text-secondary" />
          <span className={linkClass}>{salon.phone}</span>
        </a>
        <a href={`mailto:${salon.email}`} className="flex min-h-12 items-center gap-3">
          <Mail aria-hidden size={16} className="shrink-0 text-text-secondary" />
          <span className={cx(linkClass, "min-w-0 [overflow-wrap:anywhere]")}>{salon.email}</span>
        </a>
      </Card>
    </Section>
  );
}

/** What changing or cancelling costs, said once and plainly where a customer looks for it. */
export function CancellationPolicy({ state }: { state: DemoState }) {
  return (
    <Section title={t("booking.policy.title")}>
      <p className="text-sm text-text-secondary">
        {t("booking.policy.free", { hours: FREE_CHANGE_HOURS })} {state.salon.phone && t("booking.policy.late", { phone: state.salon.phone })}
      </p>
    </Section>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" className="flex items-center gap-0.5" aria-label={t("booking.stars", { count: rating })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} className={n <= rating ? "fill-text text-text" : "text-border"} />
      ))}
    </span>
  );
}

export function Reviews({ state, variant = "cards" }: { state: DemoState; variant?: string }) {
  const shown = recentReviews(state.reviews, variant === "quote" ? 1 : 3);
  const { average, count } = reviewSummary(state.reviews);
  if (!shown.length) return null;
  if (variant === "quote") return <QuoteReview state={state} review={shown[0]} />;
  return (
    <Section title={t("booking.reviews")} action={<span className="text-right text-sm text-text-secondary">{average.toFixed(1)} · {tc("booking.reviewCount", count)}</span>}>
      <Card id="reviews" className="scroll-mt-4 divide-y divide-hairline px-4">
        {shown.map((review) => {
          const customer = state.customers.find((c) => c.id === review.customerId);
          return (
            <figure key={review.id} className="space-y-1.5 py-3.5">
              <blockquote className="text-[15px] leading-relaxed">{review.text}</blockquote>
              <figcaption className="flex flex-wrap items-center gap-x-2 text-xs text-text-secondary">
                <Stars rating={review.rating} />
                {customer ? publicName(customer.firstName, customer.lastName) : ""} · {formatDate(review.date)} · {t(review.source === "Google" ? "reviews.source.google" : "reviews.source.bookingPage")}
              </figcaption>
            </figure>
          );
        })}
      </Card>
    </Section>
  );
}

/** One review, large, with the average beside it. */
function QuoteReview({ state, review }: { state: DemoState; review: Review }) {
  const { average, count } = reviewSummary(state.reviews);
  const customer = state.customers.find((c) => c.id === review.customerId);
  return (
    <Section title={t("booking.reviews")}>
      <Card id="reviews" className="scroll-mt-4 space-y-3 p-6 text-center">
        <p className="text-xl font-medium leading-snug sm:text-2xl">“{review.text}”</p>
        <p className="text-sm text-text-secondary">
          {customer ? publicName(customer.firstName, customer.lastName) : ""} · {t("booking.reviewsAverage", { average: average.toFixed(1), count })}
        </p>
      </Card>
    </Section>
  );
}
