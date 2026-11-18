import type { DemoState, Service } from "../data/types";
import { t } from "../i18n";
import { formatDuration, formatMoney } from "../i18n/format";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

/**
 * "Book" starts the booking flow with the treatment already chosen. `compact` leaves the descriptions out.
 */
export function Treatments({ state, onBook, compact }: { state: DemoState; onBook: (serviceId: string) => void; compact?: boolean }) {
  const staffNames = (service: Service) => state.staff.filter((p) => service.staffIds.includes(p.id)).map((p) => p.firstName).join(", ");
  return (
    <div className="space-y-8">
      {state.categories
        .filter((category) => state.services.some((s) => s.category === category.id))
        .map((category) => (
          <section key={category.id} aria-label={category.name} className="space-y-2.5">
            <h3 className="text-base font-semibold">{category.name}</h3>
            <Card className="divide-y divide-hairline">
              {state.services
                .filter((s) => s.category === category.id)
                .map((service) => (
                  <div key={service.id} className="px-4 py-3.5 sm:px-5">
                    <p className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 font-semibold">
                      <span className="break-words">{service.name}</span>
                      <span className="whitespace-nowrap text-right text-sm tabular-nums">{formatMoney(service.price)}</span>
                    </p>
                    {!compact && service.description && (
                      <p className="mt-1 line-clamp-3 text-pretty break-words text-sm leading-relaxed text-text-secondary">{service.description}</p>
                    )}
                    <div className="mt-1.5 flex items-center justify-between gap-3">
                      <p className="min-w-0 break-words text-[13px] leading-5 text-text-secondary">
                        {formatDuration(service.duration)} · {t("booking.withStaff", { name: staffNames(service) })}
                      </p>
                      <Button variant="secondary" size="sm" className="shrink-0" onClick={() => onBook(service.id)} aria-label={t("booking.bookService", { service: service.name })}>
                        {t("booking.book")}
                      </Button>
                    </div>
                  </div>
                ))}
            </Card>
          </section>
        ))}
    </div>
  );
}
