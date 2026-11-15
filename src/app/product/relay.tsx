import { isPublicReadonly } from "@/lib/public-readonly";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Leaf } from "lucide-react";
import { DateTime } from "luxon";
import { getAvailability, listServices } from "@/lib/domain";
import { listStaff } from "@/lib/workspace-config";
import { getLocale } from "@/lib/locale-server";
import { formatPrice, readableDay } from "@/lib/format";
import styles from "./product.module.css";

async function findDemoVisit() {
  const [services, team] = await Promise.all([listServices(), listStaff()]);
  const available = services.filter((s) =>
    team.some((p) => p.serviceIds.includes(s.id)),
  );
  const service =
    available.find((s) => /massage/i.test(s.name)) ?? available[0];
  if (!service) return;
  const person = team.find((p) => p.serviceIds.includes(service.id))!;
  const today = DateTime.now().setZone("Europe/Stockholm");
  for (let offset = 0; offset < 7; offset++) {
    const date = today.plus({ days: offset }).toISODate()!;
    const slots = await getAvailability(service.id, date, undefined, person.id);
    const slot =
      slots.find(
        (s) => DateTime.fromISO(s).setZone("Europe/Stockholm").hour >= 15,
      ) ?? slots[0];
    if (slot) return { service, person, date, slot };
  }
}

export default async function Relay() {
  const [locale, visit] = await Promise.all([getLocale(), findDemoVisit()]);
  const t = (en: string, sv: string) => (locale === "sv" ? sv : en);
  const href = visit
    ? "/?" +
      new URLSearchParams({
        service: visit.service.id,
        staff: visit.person.id,
        date: visit.date,
        slot: visit.slot,
      })
    : "/";
  const time =
    visit &&
    DateTime.fromISO(visit.slot).setZone("Europe/Stockholm").toFormat("HH:mm");
  return (
    <main className={styles.page} lang={locale}>
      <section className={styles.hero}>
        <header className={styles.nav}>
          <Link className={styles.brand} href="/product">
            <Leaf aria-hidden="true" /> Booking Lab
          </Link>
          {!isPublicReadonly() && <nav aria-label={t("Product navigation", "Produktnavigation")}>
            <Link href="/admin/overview">
              {t("Open workspace", "Öppna arbetsytan")}{" "}
              <ArrowUpRight size={16} />
            </Link>
          </nav>}
        </header>
        <div className={styles.heroBody}>
          <h1>
            {t(
              "Book through your AI assistant.",
              "Boka med din AI-assistent.",
            )}
          </h1>
          <p>
            {t(
              "Your client asks. Their assistant finds a time. They confirm, and it appears in your calendar.",
              "Kunden frågar. Assistenten hittar en tid. Kunden bekräftar och bokningen syns i din kalender.",
            )}
          </p>
          {visit && (
            <div className={styles.visit}>
              <p>{/massage/i.test(visit.service.name)
                ? t("“When can I get a massage?”", "”När kan jag få massage?”")
                : t("“When could I come in?”", "”När kan jag komma?”")}</p>
              <div>
                <strong>{time}</strong>
                <span>
                  {readableDay(visit.date, locale)}
                  <br />
                  {locale === "en" && visit.service.id === "demo-ui-massage" && visit.service.name === "Avslappnande massage"
                    ? "Relaxation massage"
                    : visit.service.name} · {visit.person.name}
                </span>
              </div>
              <small>
                {visit.service.duration} min ·{" "}
                {formatPrice(visit.service.priceOre, locale)} ·{" "}
                {t("Stockholm time", "Stockholmstid")}
              </small>
            </div>
          )}
          <Link className={styles.primary} href={href} prefetch={false}>
            {t("Try the booking demo", "Prova bokningen")}{" "}
            <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className={styles.photo}>
          <Image src="/brand/relay-interior.png" alt="" fill sizes="(max-width: 760px) 100vw, 44vw" priority />
        </div>
      </section>
      <section className={styles.section}>
        <p className={styles.eyebrow}>
          {t("Inside the workspace", "I arbetsytan")}
        </p>
        <h2>
          {t("A cancellation opens a time.", "En avbokning öppnar en tid.")}
        </h2>
        <p className={styles.lead}>
          {t(
            "See the opening in your calendar. Review a suggestion or prepare an offer for the treatment. You choose when to publish.",
            "Se luckan i kalendern. Granska förslaget eller förbered ett erbjudande för behandlingen. Du väljer när det publiceras.",
          )}
        </p>
        {!isPublicReadonly() && <Link className={styles.textLink} href="/admin/overview">
          {t("Review suggestions", "Granska förslagen")} ↗
        </Link>}
      </section>
      <footer className={styles.footer}>
        <details>
          <summary>
            {t("How assistants connect", "Så ansluter assistenter")}
          </summary>
          <p>
            {t(
              "The question above illustrates a request. Times come from the booking engine. Local PC tests cover MCP time selection, confirmed test bookings and a read-only owner card. This private web demo uses fictional data.",
              "Frågan ovan illustrerar en förfrågan. Tiderna hämtas från bokningsmotorn. Lokala PC-prov omfattar tidval via MCP, bekräftade testbokningar och ett läsbart ägarkort. Den privata webbdemon använder påhittade uppgifter.",
            )}
          </p>
        </details>
        <small>
          Booking Lab · AGPL-3.0-only · {t("Private demo", "Privat demo")}
        </small>
      </footer>
    </main>
  );
}
