import { fixtureBookingDate } from "@/lib/public-fixtures";
import { isPublicReadonly } from "@/lib/public-readonly";
import { formatPrice, readableDay } from "@/lib/format";
import { pageDataFailure } from "@/lib/errors";
import { DateTime } from "luxon";
import { listServices, publicCampaigns } from "@/lib/domain";
import BookingForm from "./booking-form";
import { listStaff } from "@/lib/workspace-config";
import { demoAccessEnabled } from "@/lib/demo-access";
import DemoEntry from "./demo-entry";
import Link from "next/link";
import Image from "next/image";
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
  return (
    <main className="booking-page">
      <header className="customer-header">
        <Link className="salon-brand" href="/">
          SALONG EKO<span>{t("Customer booking", "Kundbokning")}</span>
        </Link>
        {!isPublicReadonly() && (demoAccessEnabled() ? (
          <DemoEntry />
        ) : (
          <a className="quiet-button" href="/admin">
            {t("Owner workspace", "Salongens arbetsyta")}
          </a>
        ))}
      </header>
      <p className="product-backlink">
        <Link href="/product">{t("About Booking Lab", "Om Booking Lab")}</Link>
      </p>
      <div className="booking-intro">
        <p className="eyebrow">
          {t("Welcome to our demo salon", "Välkommen till vår demosalong")}
        </p>
        <h1>{t("A little time for you.", "Boka en behandling")}</h1>
        <p>
          {t(
            "Choose a treatment, a day and an available time. Review everything before you confirm.",
            "Välj behandling, tryck på en dag och välj en ledig tid. Du ser hela bokningen innan du bekräftar.",
          )}
        </p>
      </div>
      {isPublicReadonly() && <p role="note" id="readonly-notice">
        {t("Synthetic read-only demo. Bookings cannot be created. Do not enter personal data.",
          "Syntetisk demo i läsläge. Bokningar kan inte skapas. Ange inga personuppgifter.")}
      </p>}
      <div className="booking-layout">
        <section
          className="booking-surface"
          aria-label={t("Book a visit", "Boka en tid")}
        >
          <BookingForm
            readOnly={isPublicReadonly()}
            services={services}
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
        </section>
        <aside className="salon-information">
          <Image
            src="/demo/salon.webp"
            alt={t(
              "Fictional Salong Eko, AI-generated salon interior",
              "Den påhittade Salong Eko, AI-genererad salongsmiljö",
            )}
            width={1200}
            height={675}
            unoptimized
            className="salon-photo"
          />
          <h2>{t("Your visit", "Om ditt besök")}</h2>
          <p>
            {t(
              "All appointments use Stockholm time. Choose your treatment and team member in the booking form.",
              "Alla tider visas i svensk tid. Våra behandlingar och utförare hittar du direkt i bokningen.",
            )}
          </p>
          <div className="service-menu">
            {services.map((s) => (
              <p key={s.id}>
                <strong>{s.name}</strong>
                <span>
                  {s.duration} min · {formatPrice(s.priceOre, locale)}
                </span>
              </p>
            ))}
          </div>
          <section className="demo-people">
            <h2>{t("Meet the demo team", "Träffa våra demomedarbetare")}</h2>
            <p>
              {t(
                "Fictional people with AI-generated portraits.",
                "Fiktiva personer med AI-genererade porträtt.",
              )}
            </p>
            {staff
              .filter((p) => ["demo-ui-sofia", "demo-ui-elias"].includes(p.id))
              .map((p) => (
                <figure key={p.id}>
                  <Image
                    src={
                      p.id.endsWith("sofia")
                        ? "/demo/sofia.webp"
                        : "/demo/elias.webp"
                    }
                    alt={t(
                      `AI-generated portrait of ${p.name}, fictional team member`,
                      `AI-genererat porträtt av ${p.name}, fiktiv medarbetare`,
                    )}
                    width={160}
                    height={160}
                    unoptimized
                  />
                  <figcaption>{p.name}</figcaption>
                </figure>
              ))}
          </section>
          <div className="demo-treatment-photos">
            <Image
              src="/demo/massage.webp"
              alt={t(
                "Towels and unbranded massage oil, AI-generated demo image",
                "Handdukar och omärkt massageolja, AI-genererad demobild",
              )}
              width={720}
              height={480}
              unoptimized
            />
            <Image
              src="/demo/hair.webp"
              alt={t(
                "Hairdressing scissors and comb, AI-generated demo image",
                "Frisörsax och kam, AI-genererad demobild",
              )}
              width={720}
              height={405}
              unoptimized
            />
          </div>
          {campaigns.map((c) => (
            <section className="campaign-card" key={c.id}>
              <span className="eyebrow">{t("Demo offer", "Demokampanj")}</span>
              <h3>{c.title}</h3>
              <p>
                {c.discountPercent} % {t("off", "på")}{" "}
                {c.service.name.toLowerCase()}
              </p>
              <p>
                {readableDay(c.validFrom, locale)} –{" "}
                {readableDay(c.validUntil, locale)}
              </p>
              <small>
                {t(
                  "The booking form shows the regular price. No payment is taken in this demo.",
                  "Ordinarie pris visas i bokningen. Ingen betalning sker i demon.",
                )}
              </small>
            </section>
          ))}
          {!isPublicReadonly() && <section className="owner-entry">
            <h2>
              {t("Exploring as an owner?", "Provar du som salongsägare?")}
            </h2>
            <p>
              {t(
                "See bookings, your team, treatments and offers in the workspace.",
                "Arbetsytan visar bokningar, personal, behandlingar och kampanjer.",
              )}
            </p>
            {demoAccessEnabled() ? (
              <DemoEntry label={t("Open the workspace", "Öppna arbetsytan")} />
            ) : (
              <a href="/admin" className="button-link">
                {t("Open the workspace", "Öppna arbetsytan")}
              </a>
            )}
          </section>}
        </aside>
      </div>
    </main>
  );
}
