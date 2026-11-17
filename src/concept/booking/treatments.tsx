import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { packOf } from "../packs";
import { Button } from "../ui/button";
import { Card, Section } from "../ui/card";
import { ServiceInfo } from "./service-row";

/** Price list. "Book" starts the booking flow with the treatment already chosen. */
export function Treatments({ state, onBook }: { state: DemoState; onBook: (serviceId: string) => void }) {
  return (
    <div className="space-y-8">
      {packOf(state).categories.map((category) => (
        <Section key={category} title={t(`category.${category}`)}>
          <Card className="divide-y divide-eko-line">
            {state.services
              .filter((s) => s.category === category)
              .map((service) => (
                <div key={service.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <ServiceInfo service={service} staff={state.staff} />
                  <Button variant="secondary" className="sm:ml-auto" onClick={() => onBook(service.id)} aria-label={t("booking.bookService", { service: service.name })}>
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
