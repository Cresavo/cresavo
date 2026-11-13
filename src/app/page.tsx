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
export const dynamic = "force-dynamic";
export default async function Home() {
  const [services, campaigns, staff] = await Promise.all([
    listServices(),
    publicCampaigns(DateTime.now().setZone("Europe/Stockholm").toISODate()!),
    listStaff(),
  ]).catch(pageDataFailure);
  return (
    <main className="booking-page">
      <header className="customer-header">
        <Link className="salon-brand" href="/">
          SALONG EKO<span>Kundbokning</span>
        </Link>
        {demoAccessEnabled() ? (
          <DemoEntry />
        ) : (
          <a className="quiet-button" href="/admin">
            Salongens arbetsyta
          </a>
        )}
      </header>
      <p className="product-backlink">
        <Link href="/product">Om Booking Lab</Link>
      </p>
      <div className="booking-intro">
        <p className="eyebrow">Välkommen till vår demosalong</p>
        <h1>Boka en behandling</h1>
        <p>
          Välj behandling, tryck på en dag och välj en ledig tid. Du ser hela
          bokningen innan du bekräftar.
        </p>
      </div>
      <div className="booking-layout">
        <section className="booking-surface" aria-label="Boka en tid">
          <BookingForm
            services={services}
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
            alt="Den påhittade Salong Eko, AI-genererad salongsmiljö"
            width={1200}
            height={675}
            unoptimized
            className="salon-photo"
          />
          <h2>Om ditt besök</h2>
          <p>
            Alla tider visas i svensk tid. Våra behandlingar och utförare hittar
            du direkt i bokningen.
          </p>
          <div className="service-menu">
            {services.map((s) => (
              <p key={s.id}>
                <strong>{s.name}</strong>
                <span>
                  {s.duration} min · {formatPrice(s.priceOre)}
                </span>
              </p>
            ))}
          </div>
          <section className="demo-people">
            <h2>Träffa våra demomedarbetare</h2>
            <p>Fiktiva personer med AI-genererade porträtt.</p>
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
                    alt={`AI-genererat porträtt av ${p.name}, fiktiv medarbetare`}
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
              alt="Handdukar och omärkt massageolja, AI-genererad demobild"
              width={720}
              height={480}
              unoptimized
            />
            <Image
              src="/demo/hair.webp"
              alt="Frisörsax och kam, AI-genererad demobild"
              width={720}
              height={405}
              unoptimized
            />
          </div>
          {campaigns.map((c) => (
            <section className="campaign-card" key={c.id}>
              <span className="eyebrow">Demokampanj</span>
              <h3>{c.title}</h3>
              <p>
                {c.discountPercent} % på {c.service.name.toLowerCase()}
              </p>
              <p>
                {readableDay(c.validFrom)} – {readableDay(c.validUntil)}
              </p>
              <small>
                Ordinarie pris visas i bokningen. Ingen betalning sker i demon.
              </small>
            </section>
          ))}
          <section className="owner-entry">
            <h2>Provar du som salongsägare?</h2>
            <p>
              Arbetsytan visar bokningar, personal, behandlingar och kampanjer.
            </p>
            {demoAccessEnabled() ? (
              <DemoEntry label="Öppna arbetsytan" />
            ) : (
              <a href="/admin" className="button-link">
                Öppna arbetsytan
              </a>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
