import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { redirect, notFound } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import {
  getCustomer,
  customerBookings,
  customerHistorySchema,
} from "@/lib/customers";
import { DomainError, pageDataFailure } from "@/lib/errors";
import { formatBookingTime, formatPrice } from "@/lib/format";
import AdminHeader from "../../header";
import CustomerEditor from "../editor";
import CustomerDataPanel from "../data-panel";
import ContextLink, { ReturnLink } from "../../../components/context-link";
import { returnContext, contextualHref } from "@/lib/navigation-context";
export const dynamic = "force-dynamic";
export default async function CustomerCard({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const { id } = await params,
    actor = { kind: "admin" as const, id: admin.id };
  let customer;
  try {
    customer = await getCustomer(id, actor);
  } catch (e) {
    if (e instanceof DomainError && e.status === 404) notFound();
    pageDataFailure(e);
  }
  const raw = await searchParams,
    parsed = customerHistorySchema.safeParse({
      view: raw.view,
      cursor: raw.cursor,
    });
  const value = parsed.success ? parsed.data : customerHistorySchema.parse({});
  const { result, historyError } = await customerBookings(id, value, actor)
    .then((result) => ({ result, historyError: "" }))
    .catch(async (error) => {
      if (error instanceof DomainError && error.status === 400) {
        return {
          result: await customerBookings(
            id,
            { ...value, cursor: undefined },
            actor,
          ).catch(pageDataFailure),
          historyError: error.message,
        };
      }
      return pageDataFailure(error);
    });
  const newBooking = `/admin/bookings/new?customer=${encodeURIComponent(id)}`;
  const context = returnContext(raw, "/admin/customers");
  return (
    <>
      <AdminHeader email={admin.email} active="customers" />
      <main className="admin-workspace narrow-workspace">
        <ReturnLink context={context} fallback="/admin/customers" />
        <div className="workspace-heading customer-card-heading">
          <div>
            <p className="eyebrow">
              Kundkort{customer.archived ? " · arkiverat" : ""}
            </p>
            <h1>{customer.name}</h1>
          </div>
          {!customer.archived && (
            <ContextLink className="button-link" href={newBooking}>
              <CalendarPlus
                className="ui-icon"
                size={18}
                aria-hidden="true"
                focusable="false"
              />
              Ny bokning
            </ContextLink>
          )}
        </div>
        {raw.saved === "1" && !customer.contactRemovedAt && (
          <p role="status">
            Kundkortet är sparat. Äldre bokningar är oförändrade.
          </p>
        )}
        <section className="panel">
          <h2>Aktuella uppgifter</h2>
          {customer.contactRemovedAt ? (
            <p>
              Kontaktuppgifterna togs bort{" "}
              {formatBookingTime(customer.contactRemovedAt)}. Kortet kan inte
              återaktiveras.
            </p>
          ) : (
            <>
              <p className="customer-contact">
                {customer.email}
                {customer.phone ? ` · ${customer.phone}` : ""}
              </p>
              <details>
                <summary>Redigera kunduppgifter</summary>
                <CustomerEditor
                  key={`${customer.id}-${customer.version}`}
                  customer={customer}
                  context={context}
                />
              </details>
            </>
          )}
        </section>
        <section className="customer-visits">
          <h2>Besök</h2>
          <nav aria-label="Kundens besök" className="action-row">
            <Link
              href={contextualHref(
                `/admin/customers/${encodeURIComponent(id)}?view=upcoming`,
                context,
              )}
              aria-current={value.view === "upcoming" ? "page" : undefined}
            >
              Kommande
            </Link>
            <Link
              href={contextualHref(
                `/admin/customers/${encodeURIComponent(id)}?view=history`,
                context,
              )}
              aria-current={value.view === "history" ? "page" : undefined}
            >
              Tidigare och avbokade
            </Link>
          </nav>
          {!parsed.success && (
            <p role="alert">Ogiltigt filter. Visar kommande besök.</p>
          )}
          {historyError && <p role="alert">{historyError}</p>}
          {!result.bookings.length && (
            <div className="panel">
              <p>
                {value.view === "upcoming"
                  ? "Ingen kommande bokning."
                  : "Inga tidigare eller avbokade besök."}
              </p>
              {!customer.archived && (
                <ContextLink href={newBooking}>Boka en tid</ContextLink>
              )}
            </div>
          )}
          {result.bookings.map((b) => (
            <article className="panel" key={b.id}>
              <div className="section-heading">
                <h3>{b.serviceName}</h3>
                <span className="status-pill">
                  {b.status === "cancelled"
                    ? "Avbokad"
                    : new Date(b.startsAt) < new Date()
                      ? "Tidigare bokning"
                      : "Bokad"}
                </span>
              </div>
              <p>
                {formatBookingTime(b.startsAt.toISOString())} ·{" "}
                {formatPrice(b.priceOre)}
              </p>
              <p>Registrerat namn vid bokning: {b.customerName}</p>
              <div className="action-row">
                <ContextLink
                  href={`/admin/bookings/${encodeURIComponent(b.id)}`}
                >
                  Öppna bokningen
                </ContextLink>
                {!customer.archived && (
                  <ContextLink
                    href={`${newBooking}&service=${encodeURIComponent(b.serviceId)}&staff=${encodeURIComponent(b.staffId)}`}
                  >
                    Boka återbesök
                  </ContextLink>
                )}
              </div>
            </article>
          ))}
          {result.nextCursor && (
            <Link
              href={contextualHref(
                `/admin/customers/${encodeURIComponent(id)}?view=${value.view}&cursor=${encodeURIComponent(result.nextCursor)}`,
                context,
              )}
            >
              Fler besök
            </Link>
          )}
        </section>
        <CustomerDataPanel
          key={`${customer.id}-${customer.version}`}
          customer={customer}
        />
      </main>
    </>
  );
}
