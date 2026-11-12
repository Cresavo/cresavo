import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { listCampaigns } from "@/lib/domain";
import { pageDataFailure } from "@/lib/errors";
import AdminHeader from "../header";
import AdminActions from "../ui";
import { readableDay } from "@/lib/format";
export const dynamic = "force-dynamic";
export default async function Campaigns() {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const campaigns = await listCampaigns().catch(pageDataFailure);
  return (
    <>
      <AdminHeader email={admin.email} active="campaigns" />
      <main className="admin-workspace narrow-workspace">
        <h1>Kampanjer</h1>
        <p className="workspace-guidance">
          Granska utkasten här och publicera dem på kundernas bokningssida. Inga
          externa utskick görs. Kampanjen visas under giltighetsperioden; i
          demon ändras inte bokningens ordinarie pris automatiskt.
        </p>
        {!campaigns.length && (
          <p className="empty-state">
            Inga kampanjutkast att granska. Utkast skapas med den befintliga
            lokala agentklienten. Du kan fortfarande boka och hantera besök i
            Kalender.
          </p>
        )}
        {campaigns.map((c) => (
          <div className="panel" key={c.id}>
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
