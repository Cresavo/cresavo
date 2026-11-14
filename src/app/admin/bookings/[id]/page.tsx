import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { listServices } from "@/lib/domain";
import { getBooking } from "@/lib/booking-mutations";
import { listStaff } from "@/lib/workspace-config";
import { pageDataFailure } from "@/lib/errors";
import AdminHeader from "../../header";
import BookingEditor from "../editor";
import { returnContext, type ReturnContext } from "@/lib/navigation-context";
import { formatBookingTime } from "@/lib/format";
import { localDay } from "@/lib/time";
import { db } from "@/lib/db";
import { DEMO_BUSINESS_ID } from "@/lib/config";
import { getLocale } from "@/lib/locale-server";
import { text } from "@/lib/locale";
export const dynamic = "force-dynamic";
export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ReturnContext>;
}) {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const locale = await getLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const { id } = await params;
  const [booking, services, staff] = await Promise.all([
    getBooking(id, true),
    listServices(true),
    listStaff(undefined, true),
  ]).catch(pageDataFailure);
  // Presentation-only projection for authenticated HTML. Keep HTTP/MCP contracts
  // and actor IDs unchanged; never infer who prompted an assistant.
  const events = await db.bookingEvent
    .findMany({
      where: {
        bookingId: booking.id,
        booking: { businessId: DEMO_BUSINESS_ID },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        action: true,
        createdAt: true,
        previousStart: true,
        nextStart: true,
        actorKind: true,
      },
    })
    .catch(pageDataFailure);
  return (
    <>
      <AdminHeader email={admin.email} active="calendar" />
      <main className="admin-workspace narrow-workspace">
        <h1>{t("Booking", "Bokning")}</h1>
        <BookingEditor
          key={booking.id}
          services={services}
          staff={staff}
          booking={booking}
          context={returnContext(
            await searchParams,
            `/admin?date=${localDay(new Date(booking.startsAt))}`,
          )}
        />
        {events.length > 0 && (
          <details className="panel">
            <summary>{t("History", "Historik")}</summary>
            <ul className="event-list">
              {events.map((event, index) => (
                <li key={`${event.createdAt.toISOString()}-${index}`}>
                  <strong>
                    {event.action === "create"
                      ? t("Created", "Skapad")
                      : event.action === "move"
                        ? t("Rescheduled", "Flyttad")
                        : t("Cancelled", "Avbokad")}
                  </strong>
                  {" · "}
                  {formatBookingTime(event.createdAt.toISOString(), locale)}
                  <span>
                    {" · "}
                    {event.actorKind === "admin"
                      ? t("Business workspace", "Salongens arbetsyta")
                      : event.actorKind === "local-mcp"
                        ? t("Local agent connection", "Lokal agentanslutning")
                        : t(
                            "Customer or booking channel",
                            "Kund- eller bokningskanal",
                          )}
                  </span>
                  {event.previousStart && event.nextStart && (
                    <span>
                      {formatBookingTime(
                        event.previousStart.toISOString(),
                        locale,
                      )}{" "}
                      →{" "}
                      {formatBookingTime(event.nextStart.toISOString(), locale)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="muted">
              {t(
                "The latest 20 events. The channel shows where an action happened, not who instructed an agent.",
                "De senaste 20 händelserna. Kanalen visar var åtgärden utfördes, inte vem som gav en agent uppdraget.",
              )}
            </p>
          </details>
        )}
      </main>
    </>
  );
}
