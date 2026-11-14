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
import FocusCampaign from "./focus";
import { getLocale } from "@/lib/locale-server";
import { text } from "@/lib/locale";
export const dynamic = "force-dynamic";
export default async function Campaigns({
  searchParams,
}: {
  searchParams: Promise<ReturnContext>;
}) {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const locale = await getLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
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
            <p className="eyebrow">{t("Business", "Salongen")}</p>
            <h1>{t("Campaigns", "Kampanjer")}</h1>
          </div>
        </div>
        <p className="workspace-guidance">
          {t(
            "Review drafts and publish them on the booking page. No external messages are sent. Campaigns appear during their validity period; the demo does not automatically change the booking price.",
            "Granska utkasten här och publicera dem på kundernas bokningssida. Inga externa utskick görs. Kampanjen visas under giltighetsperioden; i demon ändras inte bokningens ordinarie pris automatiskt.",
          )}
        </p>
        {!campaigns.length && (
          <p className="empty-state">
            {t(
              "No campaign drafts to review.",
              "Inga kampanjutkast att granska.",
            )}{" "}
            <Link href="/admin/overview">
              {t("Open overview", "Öppna översikten")}
            </Link>{" "}
            {t(
              "to find available capacity for an offer.",
              "för att se om det finns ledig kapacitet att skapa ett erbjudande för.",
            )}
          </p>
        )}
        {campaigns.map((c) => (
          <div className="panel" key={c.id} id={`campaign-${c.id}`}>
            <p className="status-pill">
              {c.published
                ? t("Published", "Publicerad")
                : t("Draft · unpublished", "Utkast · inte publicerat")}
            </p>
            <h2>{c.title}</h2>
            <p>
              {c.discountPercent} % · {c.service.name} ·{" "}
              {readableDay(c.validFrom, locale)}–
              {readableDay(c.validUntil, locale)}
            </p>
            {c.published ? (
              <p role="status">
                {t(
                  "Published on the booking page during its validity period",
                  "Publicerad på bokningssidan under giltighetsperioden",
                )}
              </p>
            ) : (
              <AdminActions mode="publish" id={c.id} />
            )}
          </div>
        ))}
        <FocusCampaign />
      </main>
    </>
  );
}
