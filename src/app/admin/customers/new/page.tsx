import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import AdminHeader from "../../header";
import CustomerEditor from "../editor";
export const dynamic = "force-dynamic";
export default async function NewCustomer() {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  return (
    <>
      <AdminHeader email={admin.email} active="customers" />
      <main className="admin-workspace narrow-workspace">
        <Link href="/admin/customers">Till kunder</Link>
        <h1>Ny kund</h1>
        <p>
          Skapa ett separat kundkort. Personer slås aldrig ihop automatiskt.
        </p>
        <section className="panel">
          <CustomerEditor />
        </section>
      </main>
    </>
  );
}
