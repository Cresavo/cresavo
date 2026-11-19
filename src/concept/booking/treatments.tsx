import { WithStaff } from "./with-staff";
import type { DemoState, Service } from "../data/types";
import { t } from "../i18n";
import { formatDuration, formatMoney } from "../i18n/format";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ListRow } from "../ui/list-row";

/**
 * "Book" starts the booking flow with the treatment already chosen. `compact` leaves the descriptions out.
 */
export function Treatments({ state, onBook, compact }: { state: DemoState; onBook: (serviceId: string) => void; compact?: boolean }) {
  const staffFor = (service: Service) => state.staff.filter((p) => service.staffIds.includes(p.id));
  return (
    <div className="space-y-8">
      {state.categories
        .filter((category) => state.services.some((s) => s.category === category.id))
        .map((category) => (
          <section key={category.id} aria-label={category.name} className="space-y-3">
            <h3 className="text-body font-semibold">{category.name}</h3>
            <Card className="divide-y divide-hairline">
              {state.services
                .filter((s) => s.category === category.id)
                .map((service) => (
                  <div key={service.id} className="flex items-center gap-3 py-2 pr-4">
                    <ListRow
                      title={service.name}
                      meta={<>
                        {!compact && service.description && <span className="mb-1 line-clamp-3 text-pretty">{service.description}</span>}
                        {formatDuration(service.duration)} · <WithStaff people={staffFor(service)} />
                      </>}
                    />
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-meta font-semibold tabular-nums">{formatMoney(service.price)}</span>
                      <Button size="sm" onClick={() => onBook(service.id)} aria-label={t("booking.bookService", { service: service.name })}>{t("booking.book")}</Button>
                    </div>
                  </div>
                ))}
            </Card>
          </section>
        ))}
    </div>
  );
}
