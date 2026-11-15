import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { customerListSchema, listCustomers } from "@/lib/customers";
import { formatBookingTime } from "@/lib/format";
import AdminHeader from "../header";
import { DomainError, pageDataFailure } from "@/lib/errors";
import ContextLink from "../../components/context-link";
import { getLocale } from "@/lib/locale-server";
import { text } from "@/lib/locale";
import { presentationError } from "@/lib/presentation-errors";
export const dynamic = "force-dynamic";

export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const locale = await getLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const raw = await searchParams;
  const input = customerListSchema.safeParse(raw);
  const value = input.success ? input.data : customerListSchema.parse({});
  const actor = { kind: "admin" as const, id: admin.id };
  const { result, searchError } = await listCustomers(value, actor)
    .then((result) => ({ result, searchError: "" }))
    .catch(async (error) => {
      if (error instanceof DomainError && error.status === 400) {
        return {
          result: await listCustomers(
            { ...value, cursor: undefined },
            actor,
          ).catch(pageDataFailure),
          searchError: error.message,
        };
      }
      return pageDataFailure(error);
    });
  const next = new URLSearchParams({
    q: value.q,
    archived: value.archived,
    cursor: result.nextCursor ?? "",
  });
  return (
    <>
      <AdminHeader email={admin.email} active="customers" />
      <main className="admin-workspace">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">
              {t("People and visits", "Salongens kunder")}
            </p>
            <h1>{t("Customers", "Kunder")}</h1>
          </div>
          <ContextLink className="button-link" href="/admin/customers/new">
            <Plus
              className="ui-icon"
              size={18}
              aria-hidden="true"
              focusable="false"
            />
            {t("New customer", "Ny kund")}
          </ContextLink>
        </div>
        <p>
          {t(
            "Find a customer, see their visits and book the next one. Contact details are shown on their card in this isolated demo.",
            "Hitta kunden, se besöken och boka en ny tid. Kontaktuppgifter visas på kundkortet i den isolerade demon.",
          )}
        </p>
        {!input.success && (
          <p role="alert">
            {t(
              "Invalid search. Showing the first page.",
              "Sökningen var ogiltig. Visar första sidan.",
            )}
          </p>
        )}
        {searchError && (
          <p role="alert">{presentationError(searchError, locale)}</p>
        )}
        <form method="get" className="customer-search action-row">
          <div className="field">
            <label htmlFor="customer-search">
              {t(
                "Search name, email or phone",
                "Sök namn, e-post eller telefon",
              )}
            </label>
            <input
              id="customer-search"
              name="q"
              maxLength={80}
              defaultValue={value.q}
              type="search"
            />
          </div>
          <label>
            <input
              type="checkbox"
              name="archived"
              value="all"
              defaultChecked={value.archived === "all"}
            />{" "}
            {t("Include archived", "Visa även arkiverade")}
          </label>
          <button>
            <Search
              className="ui-icon"
              size={18}
              aria-hidden="true"
              focusable="false"
            />
            {t("Search customers", "Sök kunder")}
          </button>
        </form>
        {!result.customers.length ? (
          <section className="panel">
            <h2>
              {value.q
                ? t("No matching customers", "Inga kunder matchar sökningen")
                : t("No customers yet", "Inga kunder ännu")}
            </h2>
            <p>
              {value.q
                ? t(
                    "Try a shorter name or a different search.",
                    "Prova ett kortare namn eller en annan sökning.",
                  )
                : t(
                    "Create a fictional customer and book their first visit.",
                    "Skapa ditt första påhittade kundkort och boka en tid.",
                  )}
            </p>
            <Link href={value.q ? "/admin/customers" : "/admin/customers/new"}>
              {value.q
                ? t("Show all customers", "Visa alla kunder")
                : t("Create customer", "Skapa kund")}
            </Link>
          </section>
        ) : (
          <div className="customer-list">
            {result.customers.map((c) => (
              <ContextLink
                className="panel customer-row"
                key={c.id}
                href={`/admin/customers/${encodeURIComponent(c.id)}`}
              >
                <strong>{c.name}</strong>
                <span>
                  {c.archived
                    ? t("Archived", "Arkiverad")
                    : c.nextVisit
                      ? `${t("Next:", "Nästa:")} ${formatBookingTime(c.nextVisit, locale)}`
                      : t("No upcoming booking", "Ingen kommande bokning")}
                </span>
                <small>
                  {c.lastVisit
                    ? `${t("Previous booking:", "Tidigare bokning:")} ${formatBookingTime(c.lastVisit, locale)}`
                    : t("No previous visits", "Inga tidigare besök")}
                </small>
              </ContextLink>
            ))}
          </div>
        )}
        {result.nextCursor && (
          <Link className="quiet-button" href={`?${next}`}>
            {t("Next page", "Nästa sida")}
          </Link>
        )}
      </main>
    </>
  );
}
