import { BRAND } from "../brand";

// English copy for the platform's public sites (the coming-soon page on the
// product domain, the demo landing and the privacy note). One dictionary per
// area, so another language is one more file. The coming-soon copy is the
// brand kit's (design/brand/cresavo-v0.1/site); the landing's choices are
// explained in docs/design/cresavo/COPY.md.

export const site = {
  "soon.title": `${BRAND.name} — ${BRAND.tagline}`,
  "soon.description": "A workspace for small service businesses. Explore a day at a fictional Stockholm salon.",
  "soon.body": `${BRAND.name} brings bookings, customers and the work behind a small service business into one place. We're building it on an open-source foundation so you can choose the tools you work with.`,
  "soon.demo": "Explore the demo",
  "soon.footer": `${BRAND.name} · Coming soon`,

  "promise.first": "More time.",
  "promise.second": "On your terms.",

  "landing.title": `${BRAND.name} — booking and customers for salons and clinics`,
  "landing.description": "Your calendar, your customers and your own booking page in one calm place. Try a day at a fictional Stockholm salon.",
  "landing.home": `${BRAND.name} home`,
  "landing.intro": `${BRAND.name} keeps your calendar, your customers and your own booking page in one calm place. Less time at the desk. More with the person in your chair.`,
  "landing.studio": "Open the demo",
  "landing.booking": "See a booking page",
  "landing.note": "The demo is Salong Eko, a fictional Stockholm salon. Nothing to sign up for.",
  "landing.today.alt": "Today in the studio: the day's schedule with a free slot between two appointments.",

  "landing.book.heading": "Clients book themselves.",
  "landing.book.body": "Your booking page is open all night. Customers pick a treatment and a time, and move or cancel on their own. You wake up to a fuller calendar. The page carries your name and colours, not ours.",
  "landing.book.alt": "Salong Eko's booking page showing available times for medical foot care.",
  "landing.day.heading": "Your day on one screen.",
  "landing.day.body": "Today shows who is next and where there is room. When someone calls, you find them a time while they are still on the line.",
  "landing.back.heading": "Fewer empty chairs.",
  "landing.back.body": "A reminder goes out before each visit. When a customer is due back, you send a suggested time in one tap. A cancelled slot can go straight to the waiting list.",
  "landing.card.heading": "Every customer, remembered.",
  "landing.card.body": "Visits, notes and the treatment journal sit on one card. You know what you did last time before they sit down.",

  "landing.try.heading": "Try it in one minute.",
  "landing.try.1.title": "Book a client",
  "landing.try.1.body": "Open Today and choose “Someone is calling”. Pick a customer, a treatment and a free time.",
  "landing.try.1.link": "Open Today",
  "landing.try.2.title": "Move a time",
  "landing.try.2.body": "Open the calendar and drag a visit to a new time, or open it and choose Move.",
  "landing.try.2.link": "Open the calendar",
  "landing.try.3.title": "See the booking page",
  "landing.try.3.body": "Book a visit as a customer would. It lands in the studio's inbox.",
  "landing.try.3.link": "Open Salong Eko's page",

  "landing.start.heading": "Start simple. Add what you need.",
  "landing.start.simple": "Start simple",
  "landing.start.simple.note": "Today, Calendar, Customers, Inbox and your booking page.",
  "landing.start.everything": "Explore everything",
  "landing.start.everything.note": "Adds journal, waiting list, campaigns, stock, gift cards and finance. And an assistant for quick questions: it proposes, you approve.",
  "landing.start.switch": "You pay for what you switch on, and you can change it any time.",

  "landing.open.heading": "Open source. Yours to run.",
  "landing.open.body": `${BRAND.name} is open source, so you can host it yourself. Your data is yours to export, and other tools can connect through an open API.`,

  "landing.about": `About ${BRAND.name}`,
  "landing.footer": "Demo with fictional data. Messages and payments are simulated.",

  "waitlist.heading": "Hear when it opens.",
  "waitlist.email": "Email",
  "waitlist.email.placeholder": "you@example.com",
  "waitlist.business": "What kind of business? (optional)",
  "waitlist.business.none": "Choose one",
  "waitlist.business.salon": "Salon",
  "waitlist.business.clinic": "Clinic",
  "waitlist.business.other": "Other",
  "waitlist.submit": "Join the waitlist",
  "waitlist.consent": "We'll only email you about the launch. Unsubscribe anytime.",
  "waitlist.privacy": "Privacy",
  "waitlist.honeypot": "Leave this field empty",
  "waitlist.outcome.not-open": "Thanks! The list opens in a few days. Come back soon.",
  "waitlist.outcome.added": "Thanks! We'll email you when it opens.",
  "waitlist.outcome.invalid": "That email address doesn't look right. Please check it.",
  "waitlist.outcome.limited": "Too many tries. Please wait a few minutes.",

  "privacy.title": `Privacy · ${BRAND.name}`,
  "privacy.heading": "Privacy",
  "privacy.intro": `This is a short note for the time before ${BRAND.name} launches. A full policy will replace it before the waiting list or the product opens.`,
  "privacy.waitlist.heading": "The waiting list",
  "privacy.waitlist.body": "The waiting list is not open yet. If you submit the form today, your email address is checked and then discarded. It is not stored, logged or shared. When the list opens, we will use your address only to tell you about the launch, and every email will have an unsubscribe link.",
  "privacy.demo.heading": "The demo",
  "privacy.demo.body": "The demo uses fictional data. What you change stays in your own browser and is not sent to us. Messages and payments are simulated. Please use invented details when you try a booking.",
  "privacy.cookies.heading": "Cookies and tracking",
  "privacy.cookies.body": "These pages set no tracking cookies and load no third-party scripts.",
  "privacy.back": "Back",
} as const;
