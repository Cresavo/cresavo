import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { customerListSchema, listCustomers } from "@/lib/customers";
import { formatBookingTime } from "@/lib/format";
import AdminHeader from "../header";
import { DomainError, pageDataFailure } from "@/lib/errors";
import ContextLink from "../../components/context-link";
export const dynamic = "force-dynamic";

export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
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
            <p className="eyebrow">Salongens kunder</p>
            <h1>Kunder</h1>
          </div>
          <ContextLink className="button-link" href="/admin/customers/new">
            <Plus
              className="ui-icon"
              size={18}
              aria-hidden="true"
              focusable="false"
            />
            Ny kund
          </ContextLink>
        </div>
        <p>
          Hitta kunden, se besöken och boka en ny tid. Kontaktuppgifter visas på
          kundkortet i den isolerade demon.
        </p>
        {!input.success && (
          <p role="alert">Sökningen var ogiltig. Visar första sidan.</p>
        )}
        {searchError && <p role="alert">{searchError}</p>}
        <form method="get" className="customer-search action-row">
          <div className="field">
            <label htmlFor="customer-search">
              Sök namn, e-post eller telefon
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
            Visa även arkiverade
          </label>
          <button>
            <Search
              className="ui-icon"
              size={18}
              aria-hidden="true"
              focusable="false"
            />
            Sök kunder
          </button>
        </form>
        {!result.customers.length ? (
          <section className="panel">
            <h2>
              {value.q ? "Inga kunder matchar sökningen" : "Inga kunder ännu"}
            </h2>
            <p>
              {value.q
                ? "Prova ett kortare namn eller en annan sökning."
                : "Skapa ditt första påhittade kundkort och boka en tid."}
            </p>
            <Link href={value.q ? "/admin/customers" : "/admin/customers/new"}>
              {value.q ? "Visa alla kunder" : "Skapa kund"}
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
                    ? "Arkiverad"
                    : c.nextVisit
                      ? `Nästa: ${formatBookingTime(c.nextVisit)}`
                      : "Ingen kommande bokning"}
                </span>
                <small>
                  {c.lastVisit
                    ? `Tidigare bokning: ${formatBookingTime(c.lastVisit)}`
                    : "Inga tidigare besök"}
                </small>
              </ContextLink>
            ))}
          </div>
        )}
        {result.nextCursor && (
          <Link className="quiet-button" href={`?${next}`}>
            Nästa sida
          </Link>
        )}
      </main>
    </>
  );
}
