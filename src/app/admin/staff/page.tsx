import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { listServices } from "@/lib/domain";
import { listStaff } from "@/lib/workspace-config";
import { pageDataFailure } from "@/lib/errors";
import AdminHeader from "../header";
import StaffEditor from "./editor";
export const dynamic = "force-dynamic";
export default async function Staff({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; new?: string; saved?: string }>;
}) {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const [staff, services, params] = await Promise.all([
    listStaff(undefined, true),
    listServices(true),
    searchParams,
  ]).catch(pageDataFailure);
  const selected = params.new
    ? undefined
    : staff.find((p) => p.id === params.id);
  return (
    <>
      <AdminHeader email={admin.email} active="staff" />
      <main className="admin-workspace">
        <div className="workspace-heading">
          <h1>Personal &amp; tider</h1>
          <a className="button-link" href="/admin/staff?new=1">
            Ny medarbetare
          </a>
        </div>
        {params.saved === "1" && (
          <p className="success-message" role="status">
            Medarbetaren och tiderna är sparade.
          </p>
        )}
        <p className="workspace-guidance">
          Välj en medarbetare för behandlingar, arbetstider, pauser och
          ledighet.
        </p>
        <div className="settings-layout">
          <aside aria-label="Medarbetare" className="resource-list">
            {staff.map((p) => (
              <a
                aria-current={selected?.id === p.id ? "true" : undefined}
                href={`/admin/staff?id=${encodeURIComponent(p.id)}`}
                key={p.id}
              >
                <strong>{p.name}</strong>
                <span>{p.active ? "Aktiv" : "Inaktiv"}</span>
              </a>
            ))}
          </aside>
          {selected || params.new ? (
            <section className="panel">
              <div className="section-heading">
                <h2>{selected ? "Redigera medarbetare" : "Ny medarbetare"}</h2>
                <a href="/admin/staff">Stäng</a>
              </div>
              <StaffEditor
                key={selected ? `${selected.id}-${selected.version}` : "new"}
                staff={selected}
                services={services}
              />
            </section>
          ) : (
            <section className="panel empty-state">
              <h2>Välj en medarbetare</h2>
              <p>Öppna en medarbetare i listan eller välj Ny medarbetare.</p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
