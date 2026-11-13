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
        <h1>Bokning</h1>
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
            <summary>Historik</summary>
            <ul className="event-list">
              {events.map((event, index) => (
                <li key={`${event.createdAt.toISOString()}-${index}`}>
                  <strong>
                    {event.action === "create"
                      ? "Skapad"
                      : event.action === "move"
                        ? "Flyttad"
                        : "Avbokad"}
                  </strong>
                  {" · "}
                  {formatBookingTime(event.createdAt.toISOString())}
                  <span>
                    {" · "}
                    {event.actorKind === "admin"
                      ? "Salongens arbetsyta"
                      : event.actorKind === "local-mcp"
                        ? "Lokal agentanslutning"
                        : "Kund- eller bokningskanal"}
                  </span>
                  {event.previousStart && event.nextStart && (
                    <span>
                      {formatBookingTime(event.previousStart.toISOString())} →{" "}
                      {formatBookingTime(event.nextStart.toISOString())}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="muted">
              De senaste 20 händelserna. Kanalen visar var åtgärden utfördes,
              inte vem som gav en agent uppdraget.
            </p>
          </details>
        )}
      </main>
    </>
  );
}
