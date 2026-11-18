import type { DemoState, Service } from "../data/types";
import { t } from "../i18n";
import { formatDuration, formatMoney } from "../i18n/format";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

/**
 * Price list, made to be scanned: name and price on one line, then what it is and how long it takes.
 * "Book" starts the booking flow with the treatment already chosen. `compact` leaves the descriptions out.
 */
export function Treatments({ state, onBook, compact }: { state: DemoState; onBook: (serviceId: string) => void; compact?: boolean }) {
  const staffNames = (service: Service) => state.staff.filter((p) => service.staffIds.includes(p.id)).map((p) => p.firstName).join(", ");
  return (
    <div className="space-y-6">
      {state.categories
        .filter((category) => state.services.some((s) => s.category === category.id))
        .map((category) => (
          <section key={category.id} aria-label={category.name} className="space-y-2">
            <h3 className="text-sm font-medium text-text-secondary">{category.name}</h3>
            <Card className="divide-y divide-hairline">
              {state.services
                .filter((s) => s.category === category.id)
                .map((service) => (
                  <div key={service.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-x-3">
                        <span className="min-w-0 font-medium">{service.name}</span>
                        <strong className="shrink-0 font-semibold tabular-nums">{formatMoney(service.price)}</strong>
                      </p>
                      {!compact && service.description && <p className="mt-0.5 text-sm text-text-secondary">{service.description}</p>}
                      <p className="mt-1 text-sm text-text-secondary">
                        {formatDuration(service.duration)} · {t("booking.withStaff", { name: staffNames(service) })}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" className="shrink-0" onClick={() => onBook(service.id)} aria-label={t("booking.bookService", { service: service.name })}>
                      {t("booking.book")}
                    </Button>
                  </div>
                ))}
            </Card>
          </section>
        ))}
    </div>
  );
}
