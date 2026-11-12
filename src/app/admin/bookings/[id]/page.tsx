import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { listServices } from "@/lib/domain";
import { getBooking } from "@/lib/booking-mutations";
import { listStaff } from "@/lib/workspace-config";
import { pageDataFailure } from "@/lib/errors";
import AdminHeader from "../../header";
import BookingEditor from "../editor";
export const dynamic = "force-dynamic";
export default async function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const { id } = await params;
  const [booking, services, staff] = await Promise.all([
    getBooking(id, true),
    listServices(true),
    listStaff(undefined, true),
  ]).catch(pageDataFailure);
  return (
    <>
      <AdminHeader email={admin.email} active="calendar" />
      <main className="admin-workspace narrow-workspace">
        <h1>Bokning</h1>
        <BookingEditor
          key={`${booking.id}-${booking.version}`}
          services={services}
          staff={staff}
          booking={booking}
        />
      </main>
    </>
  );
}
