import { fixtureBookingDate } from "@/lib/public-fixtures";
import { isPublicReadonly } from "@/lib/public-readonly";
import { pageDataFailure } from "@/lib/errors";
import { DateTime } from "luxon";
import { readableDay } from "@/lib/format";
import { listServices, publicCampaigns } from "@/lib/domain";
import BookingForm from "./booking-form";
import { listStaff } from "@/lib/workspace-config";
import { demoAccessEnabled } from "@/lib/demo-access";
import DemoEntry from "./demo-entry";
import Link from "next/link";
import TwoTrackLab from "./two-track-lab";
import { getLocale } from "@/lib/locale-server";
import { text } from "@/lib/locale";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const locale = await getLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const [services, campaigns, staff] = await Promise.all([
    listServices(),
    publicCampaigns(DateTime.now().setZone("Europe/Stockholm").toISODate()!),
    listStaff(),
  ]).catch(pageDataFailure);
  const readOnly = isPublicReadonly();
  return <main className="two-track-page">
    <header className="customer-header">
      <Link className="salon-brand" href="/">BOOKING LAB<span>{t("Find a salon. Make time.", "Hitta salong. Ta dig tid.")}</span></Link>
      <nav aria-label={t("About and workspace", "Om och arbetsyta")}>
        <Link href="/product">{t("About Booking Lab", "Om Booking Lab")}</Link>
        <Link href="/boka/salong-eko">{t("Customer page demo", "Kundsida (demo)")}</Link>
        <Link href="/studio">{t("Owner studio demo", "Ägarstudio (demo)")}</Link>
        {!readOnly && (demoAccessEnabled() ? <DemoEntry /> : <a className="quiet-button" href="/admin">{t("Owner workspace", "Salongens arbetsyta")}</a>)}
      </nav>
    </header>
    {readOnly && <p role="note" id="readonly-notice">{t("Synthetic read-only demo. Bookings cannot be created. Do not enter personal data.", "Syntetisk demo i läsläge. Bokningar kan inte skapas. Ange inga personuppgifter.")}</p>}
    <TwoTrackLab demoDate={fixtureBookingDate(query)} readOnly={readOnly}>
          <>
          {campaigns.map((campaign) => (
            <section className="campaign-card" key={campaign.id}>
              <span className="eyebrow">{t("Demo offer", "Demokampanj")}</span>
              <h3>{campaign.title}</h3>
              <p>{campaign.discountPercent} % {t("off", "på")} {campaign.service.name.toLowerCase()}</p>
              <p>{readableDay(campaign.validFrom, locale)} – {readableDay(campaign.validUntil, locale)}</p>
              <small>{t(
                "The booking form shows the regular price. No payment is taken in this demo.",
                "Ordinarie pris visas i bokningen. Ingen betalning sker i demon.",
              )}</small>
            </section>
          ))}
          <BookingForm
            readOnly={readOnly}
            demoSalon="Salong Eko"
            services={readOnly ? services.map((service) => ({ ...service, name: service.id === "fotvard" ? t("Foot care", "Fotvård") : service.name })) : services}
            initialService={
              typeof query.service === "string" ? query.service : undefined
            }
            initialStaff={
              typeof query.staff === "string" ? query.staff : undefined
            }
            initialDate={
              isPublicReadonly()
                ? fixtureBookingDate(query)
                : typeof query.date === "string" ? query.date : undefined
            }
            initialSlot={
              typeof query.slot === "string" ? query.slot : undefined
            }
            staff={staff.map(({ id, name, serviceIds }) => ({
              id,
              name,
              serviceIds,
            }))}
          />
          </>
    </TwoTrackLab>
  </main>;
}
