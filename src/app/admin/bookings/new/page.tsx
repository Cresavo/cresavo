import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { listServices } from "@/lib/domain";
import { listStaff } from "@/lib/workspace-config";
import { pageDataFailure } from "@/lib/errors";
import { dateSchema } from "@/lib/validation";
import { localDay } from "@/lib/time";
import AdminHeader from "../../header";
import BookingEditor from "../editor";
export const dynamic = "force-dynamic";
export default async function NewBooking({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const [services, staff, params] = await Promise.all([
    listServices(),
    listStaff(),
    searchParams,
  ]).catch(pageDataFailure);
  const date = dateSchema.safeParse(params.date).success
    ? params.date!
    : localDay(new Date());
  return (
    <>
      <AdminHeader email={admin.email} active="calendar" />
      <main className="admin-workspace narrow-workspace">
        <h1>Ny bokning</h1>
        <BookingEditor services={services} staff={staff} date={date} />
      </main>
    </>
  );
}
