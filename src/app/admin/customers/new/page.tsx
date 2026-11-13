import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import AdminHeader from "../../header";
import CustomerEditor from "../editor";
import { ReturnLink } from "../../../components/context-link";
import { returnContext, type ReturnContext } from "@/lib/navigation-context";
export const dynamic = "force-dynamic";
export default async function NewCustomer({
  searchParams,
}: {
  searchParams: Promise<ReturnContext>;
}) {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const context = returnContext(await searchParams, "/admin/customers");
  return (
    <>
      <AdminHeader email={admin.email} active="customers" />
      <main className="admin-workspace narrow-workspace">
        <ReturnLink context={context} fallback="/admin/customers" />
        <h1>Ny kund</h1>
        <p>
          Skapa ett separat kundkort. Personer slås aldrig ihop automatiskt.
        </p>
        <section className="panel">
          <CustomerEditor context={context} />
        </section>
      </main>
    </>
  );
}
