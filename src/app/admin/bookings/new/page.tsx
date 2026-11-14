import { redirect, notFound } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { listServices } from "@/lib/domain";
import { listStaff } from "@/lib/workspace-config";
import { DomainError, pageDataFailure } from "@/lib/errors";
import { dateSchema } from "@/lib/validation";
import { localDay } from "@/lib/time";
import AdminHeader from "../../header";
import BookingEditor from "../editor";
import { getCustomer } from "@/lib/customers";
import { returnContext } from "@/lib/navigation-context";
import { getLocale } from "@/lib/locale-server";
import { text } from "@/lib/locale";
export const dynamic = "force-dynamic";
export default async function NewBooking({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    customer?: string;
    service?: string;
    staff?: string;
    returnTo?: string;
    returnKey?: string;
  }>;
}) {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const locale = await getLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const [services, staff, params] = await Promise.all([
    listServices(),
    listStaff(),
    searchParams,
  ]).catch(pageDataFailure);
  const date = dateSchema.safeParse(params.date).success
    ? params.date!
    : localDay(new Date());
  const customer = params.customer
    ? await getCustomer(params.customer, { kind: "admin", id: admin.id }).catch(
        (error) => {
          if (error instanceof DomainError && error.status === 404) notFound();
          return pageDataFailure(error);
        },
      )
    : undefined;
  const requestedStaff = staff.find((s) => s.id === params.staff && s.active);
  const preferredService = (
    services.find((s) => s.id === params.service && s.active) ??
    services.find((s) => s.active && requestedStaff?.serviceIds.includes(s.id))
  )?.id;
  const preferredStaff = staff.find(
    (s) =>
      s.id === params.staff &&
      s.active &&
      s.serviceIds.includes(preferredService ?? services[0]?.id),
  )?.id;
  return (
    <>
      <AdminHeader email={admin.email} active="calendar" />
      <main className="admin-workspace narrow-workspace">
        <h1>{t("New booking", "Ny bokning")}</h1>
        {customer?.archived ? (
          <p>
            {t(
              "This customer is archived. Reactivate them before booking.",
              "Kundkortet är arkiverat. Återaktivera det före ny bokning.",
            )}{" "}
            <a href={`/admin/customers/${customer.id}`}>
              {t("Open customer", "Öppna kundkort")}
            </a>
          </p>
        ) : (
          <BookingEditor
            services={services}
            staff={staff}
            date={date}
            customer={customer && { id: customer.id, name: customer.name }}
            preferredService={preferredService}
            preferredStaff={preferredStaff}
            context={returnContext(params, `/admin?date=${date}`)}
          />
        )}
      </main>
    </>
  );
}
