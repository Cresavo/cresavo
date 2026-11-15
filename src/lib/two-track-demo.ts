import type { Locale } from "./locale";
import { text } from "./locale";

export type DemoBooking = {
  salon: string; serviceId: string; treatment: string; duration: number;
  priceOre: number; staffId: string; person: string; day: string; start: string;
};
export type DemoStage = "review" | "declined" | "approved" | "complete";
// Local presentation state only: never a server mandate or payment credential.
export function advanceDemo(stage: DemoStage, action: "customer-yes" | "customer-no" | "agent-yes" | "pay", ready: boolean): DemoStage {
  if (!ready) return "review";
  if (action === "customer-no") return "declined";
  if (action === "customer-yes" && (stage === "review" || stage === "declined")) return "approved";
  if (action === "pay" && stage === "approved") return "complete";
  return stage;
}
export function bookingExample(booking: DemoBooking, stage: DemoStage) {
  return {
    exampleOnly: true, sent: false, tool: "create_booking",
    arguments: { ...booking, customerName: "Demo Kundsson", customerEmail: "demo@example.test",
      mandate: stage === "approved" || stage === "complete" ? "demo_customer_yes_local_only" : null,
      paymentToken: stage === "complete" ? "demo_payment_not_real" : null },
  };
}
export function heroChoices(locale: Locale) {
  return [text(locale, "Book yourself", "Boka själv"), text(locale, "Let your agent book", "Låt din agent boka")];
}
export function demoSalons(locale: Locale) {
  const t = (en: string, sv: string) => text(locale, en, sv);
  return [
    { id: "eko", name: "Salong Eko", area: "Vasastan", image: "salon.webp", description: t("A quiet moment for feet and shoulders.", "En lugn stund för fötter och axlar."), services: [
      { id: "fotvard", name: t("Foot care", "Fotvård"), duration: 60, priceOre: 65000 },
      { id: "massage", name: t("Massage", "Massage"), duration: 30, priceOre: 45000 }], people: ["Anna", "Erik"] },
    { id: "lunden", name: "Studio Lunden", area: "Södermalm", image: "hair.webp", description: t("Thoughtful hair care in a leafy studio.", "Omtänksam hårvård i en grön liten studio."), services: [
      { id: "lunden-cut", name: t("Haircut", "Klippning"), duration: 45, priceOre: 72000 },
      { id: "lunden-style", name: t("Styling", "Styling"), duration: 30, priceOre: 48000 }], people: ["Mira", "Leo"] },
    { id: "still", name: "Still Kvarteret", area: "Kungsholmen", image: "massage.webp", description: t("Gentle treatments. A little room to breathe.", "Mjuka behandlingar. Lite mer plats att andas."), services: [
      { id: "still-massage", name: t("Relaxing massage", "Avslappningsmassage"), duration: 50, priceOre: 79000 },
      { id: "still-scalp", name: t("Scalp massage", "Hårbottenmassage"), duration: 25, priceOre: 39000 }], people: ["Alva", "Sam"] },
  ];
}
