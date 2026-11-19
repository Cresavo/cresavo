import { Repeat } from "lucide-react";
import type { Booking, DemoState } from "../data/types";
import { t } from "../i18n";
import { ButtonLink } from "../ui/button";
import { rebookLink } from "./links";

export function RepeatBookingLink({ state, booking, variant = "primary" }: { state: DemoState; booking: Booking; variant?: "primary" | "secondary" }) {
  if (!state.services.some(service => service.id === booking.serviceId)) return null;
  return (
    <ButtonLink variant={variant} href={rebookLink(state.salon.slug, booking.serviceId, booking.staffId)} icon={<Repeat aria-hidden size={16} />}>
      {t("booking.me.rebook")}
    </ButtonLink>
  );
}
