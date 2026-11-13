import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { listCampaigns } from "@/lib/domain";
import { pageDataFailure } from "@/lib/errors";
import AdminHeader from "../header";
import AdminActions from "../ui";
import { readableDay } from "@/lib/format";
import { ReturnLink } from "../../components/context-link";
import { returnContext, type ReturnContext } from "@/lib/navigation-context";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Campaigns({
  searchParams,
}: {
  searchParams: Promise<ReturnContext>;
}) {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const campaigns = await listCampaigns().catch(pageDataFailure);
  return (
    <>
      <AdminHeader email={admin.email} active="campaigns" />
      <main className="admin-workspace narrow-workspace">
        <ReturnLink
          context={returnContext(await searchParams, "/admin/overview")}
          fallback="/admin/overview"
        />
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">Salongen</p>
            <h1>Kampanjer</h1>
          </div>
        </div>
        <p className="workspace-guidance">
          Granska utkasten här och publicera dem på kundernas bokningssida. Inga
          externa utskick görs. Kampanjen visas under giltighetsperioden; i
          demon ändras inte bokningens ordinarie pris automatiskt.
        </p>
        {!campaigns.length && (
          <p className="empty-state">
            Inga kampanjutkast att granska.{" "}
            <Link href="/admin/overview">Öppna översikten</Link> för att se om
            det finns ledig kapacitet att skapa ett erbjudande för.
          </p>
        )}
        {campaigns.map((c) => (
          <div className="panel" key={c.id} id={`campaign-${c.id}`}>
            <p className="status-pill">
              {c.published ? "Publicerad" : "Utkast · inte publicerat"}
            </p>
            <h2>{c.title}</h2>
            <p>
              {c.discountPercent} % · {c.service.name} ·{" "}
              {readableDay(c.validFrom)}–{readableDay(c.validUntil)}
            </p>
            {c.published ? (
              <p role="status">
                Publicerad på bokningssidan under giltighetsperioden
              </p>
            ) : (
              <AdminActions mode="publish" id={c.id} />
            )}
          </div>
        ))}
      </main>
    </>
  );
}
