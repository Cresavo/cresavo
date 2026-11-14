import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import AdminHeader from "../../header";
import CustomerEditor from "../editor";
import { ReturnLink } from "../../../components/context-link";
import { returnContext, type ReturnContext } from "@/lib/navigation-context";
import { getLocale } from "@/lib/locale-server";
import { text } from "@/lib/locale";
export const dynamic = "force-dynamic";
export default async function NewCustomer({
  searchParams,
}: {
  searchParams: Promise<ReturnContext>;
}) {
  const locale = await getLocale();
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const context = returnContext(await searchParams, "/admin/customers");
  return (
    <>
      <AdminHeader email={admin.email} active="customers" />
      <main className="admin-workspace narrow-workspace">
        <ReturnLink context={context} fallback="/admin/customers" />
        <h1>{text(locale, "New customer", "Ny kund")}</h1>
        <p>
          {text(
            locale,
            "Create a separate customer profile. People are never merged automatically.",
            "Skapa ett separat kundkort. Personer slås aldrig ihop automatiskt.",
          )}
        </p>
        <section className="panel">
          <CustomerEditor context={context} />
        </section>
      </main>
    </>
  );
}
