import type { Booking, DemoState } from "../data/types";
import { BRAND } from "../brand";
import type { MessageKey } from "../i18n";
import { customerText } from "../i18n/customer-text";
import { formatDate, formatTime } from "../i18n/format";
import { SALON_TIMEZONE } from "../tools/clock";
import { publicBookingView } from "./public-booking-view";
import type { BookingMessageKind } from "./messages";

// The e-mail a customer gets for a booking: plain, accessible HTML plus a text
// part, in the salon's language. No remote images, no tracking. Every value is
// escaped, and nothing here holds a secret: the caller passes the finished link.

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ESCAPES[c]);

export interface ConfirmationEmail {
  subject: string;
  text: string;
  html: string;
}

export function confirmationEmail(state: DemoState, booking: Booking, kind: BookingMessageKind, link: string | undefined, now = Date.now()): ConfirmationEmail {
  const language = state.localization.language;
  const say = (key: MessageKey, vars?: Record<string, string>) => customerText(state, key, vars);
  const view = publicBookingView(state, booking, now);
  const date = formatDate(booking.date, language);
  const time = formatTime(booking.start, language);
  const rows = [
    [say("bookingEmail.treatment"), view.treatment],
    ...(view.staffFirstName ? [[say("bookingEmail.with"), view.staffFirstName]] : []),
    [say("bookingEmail.when"), say("bookingEmail.whenValue", { date, time })],
    ...(view.salon.address ? [[say("bookingEmail.where"), `${state.salon.name}, ${view.salon.address}`]] : []),
    ...(view.salon.phone ? [[say("bookingEmail.phone"), view.salon.phone]] : []),
  ];
  // Once cancelled there is nothing left to cancel or change, so the notes would only mislead.
  const notes = kind === "cancellation" ? [] : [
    ...(view.freeUntil ? [say("booking.cancelUntil", { day: formatDate(view.freeUntil.date, language), time: formatTime(view.freeUntil.time, language), zone: SALON_TIMEZONE })] : []),
    ...(view.salon.phone ? [say("booking.changeByPhone", { phone: view.salon.phone })] : []),
  ];
  const heading = say(`bookingEmail.heading.${kind}`, { date, time });
  const manage = say("bookingEmail.manage");
  const footer = say("bookingEmail.footer", { salon: state.salon.name, brand: BRAND.name });
  return {
    subject: say(`bookingEmail.subject.${kind}`, { treatment: view.treatment, date, time }).replace(/\s+/g, " "),
    text: [heading, "", ...rows.map(([label, value]) => `${label}: ${value}`), "", ...notes, "", ...(link ? [`${manage}: ${link}`, ""] : []), footer].join("\n"),
    html: `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${escape(heading)}</title></head>`
      + `<body style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a;max-width:36rem;margin:0 auto;padding:16px">`
      + `<h1 style="font-size:22px">${escape(heading)}</h1>`
      + `<table role="presentation" style="border-collapse:collapse">${rows.map(([label, value]) =>
        `<tr><th scope="row" style="text-align:left;padding:2px 16px 2px 0;font-weight:bold">${escape(label)}</th><td>${escape(value)}</td></tr>`).join("")}</table>`
      + notes.map((note) => `<p>${escape(note)}</p>`).join("")
      + (link ? `<p><a href="${escape(link)}" style="color:#0b57d0">${escape(manage)}</a></p>` : "")
      + `<p style="font-size:14px;color:#555555">${escape(footer)}</p></body></html>`,
  };
}
