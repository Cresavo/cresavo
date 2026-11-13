import Image from "next/image";
import Link from "next/link";
import { demoAccessEnabled } from "@/lib/demo-access";
import DemoEntry from "../demo-entry";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Booking Lab – mer tid för salongen",
  description:
    "Kalender, bokningar och kunder för små salonger. Prova en tidig version med en helt påhittad demosalong.",
};
export default function Product() {
  return (
    <main className="product-page">
      <header className="product-nav">
        <Link className="salon-brand" href="/product">
          BOOKING LAB<span>Produktsida · tidig version</span>
        </Link>
        <nav aria-label="Välj upplevelse">
          <Link href="/">Se kundbokningen</Link>
          <Link href="/admin/overview">Salongens arbetsyta</Link>
        </nav>
      </header>
      <section className="product-hero">
        <div>
          <p className="eyebrow">För salongens vardag</p>
          <h1>
            Håll ihop dagen.
            <br />
            Och kunderna.
          </h1>
          <p className="product-lead">
            Bokningar, kundkort och arbetstider på ett ställe. Booking Lab
            hjälper små salonger att se dagens besök och boka nästa, utan att
            tappa historiken.
          </p>
          <div className="action-row">
            {demoAccessEnabled() ? (
              <DemoEntry label="Prova salongens arbetsyta" />
            ) : (
              <Link className="button-link" href="/admin">
                Prova salongens arbetsyta
              </Link>
            )}
            <Link className="quiet-button" href="/">
              Se kundbokningen
            </Link>
          </div>
          <p className="product-note">
            En fungerande tidig demo med påhittade personer. Ingen kundpilot,
            betalning eller utskick.
          </p>
        </div>
        <figure>
          <Image
            src="/demo/salon.webp"
            alt="AI-genererad miljö från den fiktiva demosalongen Salong Eko"
            width={1200}
            height={675}
            priority
            unoptimized
          />
          <figcaption>Salong Eko – vår helt påhittade demosalong.</figcaption>
        </figure>
      </section>
      <section className="product-section" aria-labelledby="daily-title">
        <p className="eyebrow">En vanlig arbetsdag</p>
        <h2 id="daily-title">Från dagens besök till nästa återbesök</h2>
        <div className="product-features">
          <article>
            <h3>Se dagen</h3>
            <p>
              Kalender med personal och bokningar. Skapa en tid, flytta ett
              besök eller avboka med tydlig bekräftelse.
            </p>
          </article>
          <article>
            <h3>Lär känna besöken</h3>
            <p>
              Sök fram kundkortet, se kommande och tidigare bokningar och boka
              ett återbesök med kunden förvald.
            </p>
          </article>
          <article>
            <h3>Gör plats i schemat</h3>
            <p>
              Ändra behandlingar, priser och personalens arbetstider, pauser och
              ledighet.
            </p>
          </article>
        </div>
      </section>
      <section className="product-section">
        <h2>Prova på tre minuter</h2>
        <ol className="product-steps">
          <li>
            <strong>Öppna salongens arbetsyta.</strong> Titta på kalendern och
            välj en påhittad kund.
          </li>
          <li>
            <strong>Boka ett återbesök.</strong> Välj dag och ledig tid med
            kalendern.
          </li>
          <li>
            <strong>Byt till kundens vy.</strong> Prova hur en besökare väljer
            behandling och bokar själv.
          </li>
        </ol>
      </section>
      <section className="product-section product-shots">
        <h2>Så ser arbetsytan ut</h2>
        <p>Skärmbilder från den fungerande demon, med syntetiska uppgifter.</p>
        <div className="product-features">
          <figure>
            <Image
              src="/demo/workspace.png"
              alt="Booking Labs mobilkalender med dagens påhittade besök"
              width={390}
              height={844}
              unoptimized
            />
            <figcaption>Dagens besök</figcaption>
          </figure>
          <figure>
            <Image
              src="/demo/customer-card.png"
              alt="Kundkort med påhittad kund och besökshistorik"
              width={390}
              height={844}
              unoptimized
            />
            <figcaption>Kunden och besöken</figcaption>
          </figure>
        </div>
      </section>
      <footer className="product-footer">
        <h2>Byggt för små salonger. Fortfarande under utveckling.</h2>
        <p>
          Kalender, bokningar, kunder, behandlingar och personal finns att
          prova. Det lokala agentstödet är en separat teknisk POC – ingen färdig
          molnassistent. Kunddrift kräver mer arbete med dataskydd och drift.
        </p>
        {demoAccessEnabled() ? (
          <DemoEntry label="Öppna arbetsytan" />
        ) : (
          <Link className="button-link" href="/admin">
            Öppna arbetsytan
          </Link>
        )}
        <Link href="/">Se kundbokningen</Link>
        <p>
          Booking Lab är ett arbetsnamn. Bilderna är AI-genererade; personer och
          salong är fiktiva.
        </p>
      </footer>
    </main>
  );
}
