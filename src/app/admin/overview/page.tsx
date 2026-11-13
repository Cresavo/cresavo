import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { listCapacity } from "@/lib/capacity";
import { pageDataFailure } from "@/lib/errors";
import AdminHeader from "../header";
import CapacityOverview from "./overview";
export const dynamic = "force-dynamic";
export default async function Overview() {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const result = await listCapacity({}, { kind: "admin", id: admin.id }).catch(
    pageDataFailure,
  );
  return (
    <>
      <AdminHeader email={admin.email} active="overview" />
      <main className="admin-workspace narrow-workspace">
        <p className="eyebrow">Salongens arbetsdag</p>
        <h1>Översikt</h1>
        <p>
          Här finns avbokade tider att ta ställning till. Förslagen bygger på
          bokningar och aktuella scheman, utan AI-analys eller intäktsprognoser.
        </p>
        <CapacityOverview initial={result} />
      </main>
    </>
  );
}
