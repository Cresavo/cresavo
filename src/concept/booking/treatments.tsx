import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { packOf } from "../packs";
import { Button } from "../ui/button";
import { Card, Section } from "../ui/card";
import { ServiceInfo } from "./service-row";

/** Price list. "Book" starts the booking flow with the treatment already chosen. */
export function Treatments({ state, onBook, compact }: { state: DemoState; onBook: (serviceId: string) => void; compact?: boolean }) {
  return (
    <div className="space-y-8">
      {packOf(state).categories.map((category) => (
        <Section key={category} title={t(`category.${category}`)}>
          <Card className={compact ? "grid divide-y divide-eko-line sm:grid-cols-2 sm:divide-y-0" : "divide-y divide-eko-line"}>
            {state.services
              .filter((s) => s.category === category)
              .map((service) => (
                <div key={service.id} className={compact ? "flex flex-col gap-3 p-4" : "flex flex-col gap-3 p-4 sm:flex-row sm:items-center"}>
                  <ServiceInfo service={service} staff={state.staff} />
                  <Button variant="secondary" className={compact ? "self-start" : "sm:ml-auto"} onClick={() => onBook(service.id)} aria-label={t("booking.bookService", { service: service.name })}>
                    {t("booking.book")}
                  </Button>
                </div>
              ))}
          </Card>
        </Section>
      ))}
    </div>
  );
}
