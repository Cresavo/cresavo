"use client";
import { useState } from "react";
import { advanceDemo, bookingExample, type DemoBooking, type DemoStage } from "@/lib/two-track-demo";
import { intlLocale, text } from "@/lib/locale";
import { formatPrice, readableDay } from "@/lib/format";
import { useLocale } from "./components/locale-provider";

export function DemoConfirmation({ booking, agent = false }: { booking: DemoBooking; agent?: boolean }) {
  const locale = useLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const [stage, setStage] = useState<DemoStage>("review");
  const act = (action: Parameters<typeof advanceDemo>[1]) => setStage((current) => advanceDemo(current, action, true));
  return <div className="demo-confirmation">
    <div className={agent ? "booking-representations" : ""}>
      <section data-testid="booking-card" className="demo-booking-card" aria-label={t("Booking proposal", "Bokningsförslag")}>
        <span className="eyebrow">{t("Your proposed visit", "Ditt föreslagna besök")}</span>
        <h3>{booking.treatment}</h3>
        <p>{booking.duration} min · {formatPrice(booking.priceOre, locale)}</p>
        <p>{booking.person} · {booking.salon}</p>
        <p>{readableDay(booking.day, locale)}<br />{t("at", "kl.")} {new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(booking.start))} · Europe/Stockholm</p>
      </section>
      {agent && <section aria-label={t("Unsent MCP example", "Oskickat MCP-exempel")}>
        <h3>{t("The same visit · MCP / JSON", "Samma besök · MCP / JSON")}</h3>
        <p>{t("Illustration only. No API call is sent.", "Bara ett exempel. Inget API-anrop skickas.")}</p>
        <pre data-testid="booking-json"><code>{JSON.stringify(bookingExample(booking, stage), null, 2)}</code></pre>
      </section>}
    </div>
    <section data-testid="agent-step" className="approval-step" aria-label={t("Customer approval", "Kundens godkännande")}>
      <h3>{agent ? "2" : "3"}. {t("Your approval", "Ditt godkännande")}</h3>
      <p>{t("Only you can approve this exact visit. The agent cannot say yes for you. This local demo approval is not a server mandate.", "Bara du kan godkänna exakt detta besök. Agenten kan inte säga ja åt dig. Demons lokala godkännande är inget servermandat.")}</p>
      <div className="demo-actions">
        <button type="button" data-testid="customer-yes" disabled={stage === "approved" || stage === "complete"} onClick={() => act("customer-yes")}>{stage === "approved" || stage === "complete" ? t("Approved", "Godkänt") : agent ? t("Yes, I approve this visit", "Ja, jag godkänner besöket") : t("Confirm this time in the demo", "Bekräfta tiden i demon")}</button>
        <button type="button" data-testid="customer-no" className="secondary" onClick={() => act("customer-no")}>{t("No, cancel", "Nej, avbryt")}</button>
      </div>
      {stage === "declined" && <p role="status">{t("Cancelled. No mandate, payment token or booking was created.", "Avbrutet. Inget mandat, betalningstoken eller bokning skapades.")}</p>}
      {(stage === "approved" || stage === "complete") && <p role="status">{t("You approved the proposal locally. No booking has been created.", "Du godkände förslaget lokalt. Ingen bokning har skapats.")}</p>}
    </section>
    {(stage === "approved" || stage === "complete") && <section data-testid="simulated-payment" className="payment-step" aria-label={t("Simulated prepayment", "Simulerad förskottsbetalning")}>
      <h3>{agent ? "3" : "4"}. {t("Simulated prepayment", "Simulerad förskottsbetalning")}</h3>
      <p>{t("A separate step after your approval. Simulate a token limited to this visit and price. No money is charged and no payment details are collected.", "Ett separat steg efter ditt godkännande. Simulera ett token avgränsat till besöket och priset. Inga pengar dras och inga betaluppgifter samlas in.")}</p>
      <button type="button" data-testid="simulated-payment-confirm" disabled={stage === "complete"} onClick={() => act("pay")}>{t("Simulate payment token", "Simulera betalningstoken")} · {formatPrice(booking.priceOre, locale)}</button>
      {stage === "complete" && <div role="status"><h4>{t("Demo complete", "Demon är klar")}</h4><p>{t("A fictional token was simulated. No booking, real payment, email or SMS. Nothing was saved or sent.", "Ett påhittat token simulerades. Ingen bokning, riktig betalning, mejl eller SMS. Inget sparades eller skickades.")}</p></div>}
    </section>}
  </div>;
}
