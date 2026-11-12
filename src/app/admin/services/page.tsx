import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { listServices } from "@/lib/domain";
import { formatPrice } from "@/lib/format";
import { pageDataFailure } from "@/lib/errors";
import AdminHeader from "../header";
import ServiceEditor from "./editor";
export const dynamic = "force-dynamic";
export default async function Services({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; new?: string; saved?: string }>;
}) {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const [services, params] = await Promise.all([
    listServices(true),
    searchParams,
  ]).catch(pageDataFailure);
  const selected = params.new
    ? undefined
    : (services.find((s) => s.id === params.id) ?? services[0]);
  return (
    <>
      <AdminHeader email={admin.email} active="services" />
      <main className="admin-workspace">
        <div className="workspace-heading">
          <h1>Tjänster</h1>
          <a className="button-link" href="/admin/services?new=1">
            Ny behandling
          </a>
        </div>
        {params.saved === "1" && (
          <p className="success-message" role="status">
            Behandlingen är sparad.
          </p>
        )}
        <p className="workspace-guidance">
          Välj en behandling för att ändra pris och längd. Skapa nya med Ny
          behandling och koppla dem sedan till rätt person under Personal &amp;
          tider.
        </p>
        <div className="settings-layout">
          <aside aria-label="Behandlingar" className="resource-list">
            {services.map((s) => (
              <a
                aria-current={selected?.id === s.id ? "true" : undefined}
                href={`/admin/services?id=${encodeURIComponent(s.id)}`}
                key={s.id}
              >
                <strong>{s.name}</strong>
                <span>
                  {s.duration} min · {formatPrice(s.priceOre)}
                  {!s.active ? " · Inaktiv" : ""}
                </span>
              </a>
            ))}
          </aside>
          <section className="panel">
            <h2>{selected ? "Redigera behandling" : "Ny behandling"}</h2>
            <ServiceEditor
              key={selected ? `${selected.id}-${selected.version}` : "new"}
              service={selected}
            />
          </section>
        </div>
      </main>
    </>
  );
}
