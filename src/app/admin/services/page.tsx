import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { listServices } from "@/lib/domain";
import { formatPrice } from "@/lib/format";
import { pageDataFailure } from "@/lib/errors";
import AdminHeader from "../header";
import ServiceEditor from "./editor";
import { getLocale } from "@/lib/locale-server";
import { text } from "@/lib/locale";
export const dynamic = "force-dynamic";
export default async function Services({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; new?: string; saved?: string }>;
}) {
  const locale = await getLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const [services, params] = await Promise.all([
    listServices(true),
    searchParams,
  ]).catch(pageDataFailure);
  const selected = params.new
    ? undefined
    : services.find((s) => s.id === params.id);
  return (
    <>
      <AdminHeader email={admin.email} active="services" />
      <main className="admin-workspace">
        <div className="workspace-heading">
          <h1>{t("Services", "Tjänster")}</h1>
          <a className="button-link" href="/admin/services?new=1">
            {t("New treatment", "Ny behandling")}
          </a>
        </div>
        {params.saved === "1" && (
          <p className="success-message" role="status">
            {t("Treatment saved.", "Behandlingen är sparad.")}
          </p>
        )}
        <p className="workspace-guidance">
          {t(
            "Treatments, prices and durations. Select a treatment to edit it.",
            "Behandlingar, priser och längder. Välj en behandling för att ändra den.",
          )}
        </p>
        <div className="settings-layout">
          <aside
            aria-label={t("Treatments", "Behandlingar")}
            className="resource-list"
          >
            {services.map((s) => (
              <a
                aria-current={selected?.id === s.id ? "true" : undefined}
                href={`/admin/services?id=${encodeURIComponent(s.id)}`}
                key={s.id}
              >
                <strong>{s.name}</strong>
                <span>
                  {s.duration} min · {formatPrice(s.priceOre, locale)}
                  {!s.active ? t(" · Inactive", " · Inaktiv") : ""}
                </span>
              </a>
            ))}
          </aside>
          {selected || params.new ? (
            <section className="panel">
              <div className="section-heading">
                <h2>
                  {selected
                    ? t("Edit treatment", "Redigera behandling")
                    : t("New treatment", "Ny behandling")}
                </h2>
                <a href="/admin/services">{t("Close", "Stäng")}</a>
              </div>
              <ServiceEditor
                key={selected ? `${selected.id}-${selected.version}` : "new"}
                service={selected}
              />
            </section>
          ) : (
            <section className="panel empty-state">
              <h2>{t("Choose a treatment", "Välj en behandling")}</h2>
              <p>
                {t(
                  "Open a treatment in the list or choose New treatment.",
                  "Öppna en behandling i listan eller välj Ny behandling.",
                )}
              </p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
