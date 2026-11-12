import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { listCampaigns } from "@/lib/domain";
import { pageDataFailure } from "@/lib/errors";
import AdminHeader from "../header";
import AdminActions from "../ui";
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
        {!campaigns.length && (
          <p className="empty-state">
            Inga kampanjer ännu. Skapa ett utkast via lokal MCP.
          </p>
        )}
        {campaigns.map((c) => (
          <div className="panel" key={c.id}>
            <h2>{c.title}</h2>
            <p>
              {c.discountPercent} % · {c.service.name} · {c.validFrom}–
              {c.validUntil}
            </p>
            {c.published ? (
              <p>Publicerad</p>
            ) : (
              <AdminActions mode="publish" id={c.id} />
            )}
          </div>
        ))}
      </main>
    </>
  );
}
