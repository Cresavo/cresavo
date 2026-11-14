import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { listServices } from "@/lib/domain";
import { listStaff } from "@/lib/workspace-config";
import { pageDataFailure } from "@/lib/errors";
import AdminHeader from "../header";
import StaffEditor from "./editor";
import { getLocale } from "@/lib/locale-server";
import { text } from "@/lib/locale";
export const dynamic = "force-dynamic";
export default async function Staff({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; new?: string; saved?: string }>;
}) {
  const locale = await getLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
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
          <h1>{t("Team & schedules", "Personal & tider")}</h1>
          <a className="button-link" href="/admin/staff?new=1">
            {t("New team member", "Ny medarbetare")}
          </a>
        </div>
        {params.saved === "1" && (
          <p className="success-message" role="status">
            {t(
              "Team member and schedule saved.",
              "Medarbetaren och tiderna är sparade.",
            )}
          </p>
        )}
        <p className="workspace-guidance">
          {t(
            "Choose a team member to manage treatments, working hours, breaks and time off.",
            "Välj en medarbetare för behandlingar, arbetstider, pauser och ledighet.",
          )}
        </p>
        <div className="settings-layout">
          <aside
            aria-label={t("Team members", "Medarbetare")}
            className="resource-list"
          >
            {staff.map((p) => (
              <a
                aria-current={selected?.id === p.id ? "true" : undefined}
                href={`/admin/staff?id=${encodeURIComponent(p.id)}`}
                key={p.id}
              >
                <strong>{p.name}</strong>
                <span>
                  {p.active ? t("Active", "Aktiv") : t("Inactive", "Inaktiv")}
                </span>
              </a>
            ))}
          </aside>
          {selected || params.new ? (
            <section className="panel">
              <div className="section-heading">
                <h2>
                  {selected
                    ? t("Edit team member", "Redigera medarbetare")
                    : t("New team member", "Ny medarbetare")}
                </h2>
                <a href="/admin/staff">{t("Close", "Stäng")}</a>
              </div>
              <StaffEditor
                key={selected ? `${selected.id}-${selected.version}` : "new"}
                staff={selected}
                services={services}
              />
            </section>
          ) : (
            <section className="panel empty-state">
              <h2>{t("Choose a team member", "Välj en medarbetare")}</h2>
              <p>
                {t(
                  "Open a team member in the list or choose New team member.",
                  "Öppna en medarbetare i listan eller välj Ny medarbetare.",
                )}
              </p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
