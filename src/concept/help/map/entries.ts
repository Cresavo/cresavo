import type { HelpEntry } from "./types";

// The indexed map of the studio that "Show me" follows. Every entry has an element with the same `data-help-id` in
// the source, and tests check both directions (tests/concept-help-map.test.ts) and that each anchor renders
// (tests/concept-e2e/help-map.spec.ts). Add an entry and its anchor together, with its caption and search words in
// both dictionaries (`src/concept/i18n/show-me-*.ts`).

type Extra = Pick<HelpEntry, "global" | "module" | "viewport" | "prefer" | "pointOnly" | "empty">;

const go = (id: string, route: string, path: readonly string[], label: HelpEntry["label"], extra: Extra = {}): HelpEntry =>
  ({ id, route, path, safety: "navigate", label, ...extra });
const change = (id: string, route: string, path: readonly string[], label: HelpEntry["label"], extra: Extra = {}): HelpEntry =>
  ({ id, route, path, safety: "changes-data", label, ...extra });

const STUDIO = "/studio";
const CALENDAR = "/studio/calendar";
const CUSTOMERS = "/studio/customers";
const CUSTOMER = "/studio/customers/[id]";
const IMPORT = "/studio/customers/import";
const INBOX = "/studio/inbox";
const MORE = "/studio/more";
const SETTINGS = "/studio/more/settings";
const ADVANCED = "/studio/more/advanced";
const shell = { global: true } as const;

const toMore = ["nav.more"] as const;
const toSettings = ["nav.more", "more.settings"] as const;
const toAdvanced = ["nav.more", "more.settings", "settings.advanced"] as const;
const toBooking = ["nav.calendar", "calendar.booking"] as const;
const toCustomer = ["nav.customers", "customers.row"] as const;
const toData = ["nav.more", "more.data"] as const;

export const HELP_MAP: readonly HelpEntry[] = [
  // The studio frame: the phone's tab bar and top bar, the desktop sidebar and title row.
  go("nav.today", STUDIO, [], "nav.today", shell),
  go("nav.calendar", STUDIO, [], "nav.calendar", shell),
  go("nav.customers", STUDIO, [], "nav.customers", shell),
  go("nav.inbox", STUDIO, [], "nav.inbox", shell),
  go("nav.more", STUDIO, [], "nav.more", { ...shell, viewport: "phone" }),
  go("shell.help", STUDIO, [], "help.button", shell),
  go("shell.assistant", STUDIO, [], "showMe.shell.assistant.label", { ...shell, module: "assistant" }),
  go("shell.quick-actions", STUDIO, [], "quick.title", { ...shell, viewport: "phone" }),
  go("shell.search", STUDIO, [], "showMe.shell.search.label", { ...shell, viewport: "desktop" }),
  go("shell.notices", STUDIO, [], "notices.title", shell),
  change("shell.theme", STUDIO, [], "theme.darkSwitch", shell),
  go("shell.view-page", STUDIO, [], "quick.viewPage", { ...shell, viewport: "desktop" }),

  // Help, in the sheet the Help button opens.
  go("help.show-me", STUDIO, ["shell.help"], "showMe.help.show-me.label", { ...shell, pointOnly: true }),
  go("help.whats-new", STUDIO, ["shell.help"], "whatsNew.title", shell),
  go("help.history", STUDIO, ["shell.help"], "nav.log", shell),
  go("log.trash", "/studio/more/log", ["shell.help", "help.history"], "log.tab.trash"),
  go("log.tickets", "/studio/more/log", ["shell.help", "help.history"], "log.tab.tickets"),

  // Today.
  go("today.phone-mode", STUDIO, ["nav.today"], "today.phoneMode"),
  go("today.morning-brief", STUDIO, ["nav.today"], "showMe.today.morning-brief.label", { pointOnly: true }),

  // Calendar and a booking's details.
  change("calendar.new-booking", CALENDAR, ["nav.calendar"], "calendar.newBooking"),
  go("calendar.view-day", CALENDAR, ["nav.calendar"], "showMe.calendar.view-day.label"),
  go("calendar.view-week", CALENDAR, ["nav.calendar"], "showMe.calendar.view-week.label"),
  go("calendar.month", CALENDAR, ["nav.calendar"], "showMe.calendar.month.label"),
  go("calendar.previous", CALENDAR, ["nav.calendar"], "calendar.previous"),
  go("calendar.next", CALENDAR, ["nav.calendar"], "calendar.next"),
  go("calendar.options", CALENDAR, ["nav.calendar"], "calendar.options"),
  go("calendar.booking", CALENDAR, ["nav.calendar"], "showMe.calendar.booking.label", { empty: { pointAt: ["calendar.next", "calendar.new-booking"] } }),
  change("booking.move", CALENDAR, toBooking, "showMe.booking.move.label", { prefer: "upcoming" }),
  change("booking.cancel", CALENDAR, toBooking, "booking.cancel", { prefer: "upcoming" }),
  change("booking.take-payment", CALENDAR, toBooking, "register.take", { prefer: "past" }),
  change("booking.mark-done", CALENDAR, toBooking, "booking.markDone", { prefer: "past" }),
  go("booking.customer-card", CALENDAR, toBooking, "booking.customerCard"),

  // Customers, a customer's card and importing.
  go("customers.search", CUSTOMERS, ["nav.customers"], "showMe.customers.search.label"),
  go("customers.row", CUSTOMERS, ["nav.customers"], "showMe.customers.row.label", { empty: { pointAt: ["customers.search", "customers.import"] } }),
  go("customers.import", CUSTOMERS, ["nav.customers"], "import.title"),
  change("customer.book", CUSTOMER, toCustomer, "showMe.customer.book.label"),
  go("customer.actions", CUSTOMER, toCustomer, "customer.rights.title"),
  change("customer.edit", CUSTOMER, [...toCustomer, "customer.actions"], "customer.edit"),
  change("customer.sell", CUSTOMER, toCustomer, "stock.sell", { module: "stock" }),
  go("customer.journal", CUSTOMER, toCustomer, "customer.tab.journal", { module: "journal" }),
  change("customer.delete", CUSTOMER, [...toCustomer, "customer.actions"], "customer.delete"),
  change("import.example", IMPORT, ["nav.customers", "customers.import"], "import.useExample"),
  change("import.file", IMPORT, ["nav.customers", "customers.import"], "showMe.import.file.label"),

  // Inbox.
  go("inbox.filters", INBOX, ["nav.inbox"], "inbox.filter", { pointOnly: true }),
  go("inbox.message", INBOX, ["nav.inbox"], "showMe.inbox.message.label", { empty: { pointAt: ["inbox.filters"] } }),
  change("inbox.reply", INBOX, ["nav.inbox", "inbox.message"], "showMe.inbox.reply.label"),
  change("inbox.mark-all-read", INBOX, ["nav.inbox"], "inbox.markAllRead"),

  // More, and the sidebar groups on a desktop.
  go("more.services", MORE, toMore, "nav.services"),
  go("more.booking-page", MORE, toMore, "nav.bookingPage"),
  go("more.staff", MORE, toMore, "nav.staff"),
  go("more.stock", MORE, toMore, "nav.stock", { module: "stock" }),
  go("more.giftcards", MORE, toMore, "features.giftcards", { module: "giftcards" }),
  go("more.campaigns", MORE, toMore, "nav.campaigns", { module: "campaigns" }),
  go("more.finance", MORE, toMore, "nav.finance", { module: "finance" }),
  go("more.assistant", MORE, toMore, "nav.assistant", { module: "assistant" }),
  go("more.features", MORE, toMore, "nav.features"),
  go("more.data", MORE, toMore, "nav.data"),
  go("more.settings", MORE, toMore, "nav.settings"),
  go("more.advanced", MORE, toMore, "nav.advanced"),

  // Business pages under More.
  change("services.add", "/studio/more/services", ["nav.more", "more.services"], "services.add"),
  change("services.categories", "/studio/more/services", ["nav.more", "more.services"], "services.categories"),
  go("services.treatment", "/studio/more/services", ["nav.more", "more.services"], "showMe.services.treatment.label", { empty: { pointAt: ["services.add"] } }),
  change("booking-page.editor", "/studio/more/booking-page", ["nav.more", "more.booking-page"], "showMe.booking-page.editor.label"),
  go("booking-page.open", "/studio/more/booking-page", ["nav.more", "more.booking-page"], "pageEditor.open"),
  change("staff.edit-week", "/studio/more/staff", ["nav.more", "more.staff"], "schedule.editWeek"),
  change("staff.time-off", "/studio/more/staff", ["nav.more", "more.staff"], "schedule.markOff"),
  change("staff.add-shift", "/studio/more/staff", ["nav.more", "more.staff"], "schedule.addShift"),
  change("stock.sell", "/studio/more/stock", ["nav.more", "more.stock"], "stock.sell", { module: "stock" }),
  change("stock.receive", "/studio/more/stock", ["nav.more", "more.stock"], "stock.receive", { module: "stock" }),
  change("stock.order", "/studio/more/stock", ["nav.more", "more.stock"], "stock.createOrder", { module: "stock" }),
  change("giftcards.sell", "/studio/more/giftcards", ["nav.more", "more.giftcards"], "giftcards.sell", { module: "giftcards" }),
  go("campaigns.new", "/studio/more/campaigns", ["nav.more", "more.campaigns"], "campaigns.new", { module: "campaigns" }),
  go("campaigns.photos", "/studio/more/campaigns", ["nav.more", "more.campaigns"], "photos.title", { module: "campaigns" }),
  change("finance.add-cost", "/studio/more/finance", ["nav.more", "more.finance"], "finance.addCost", { module: "finance" }),
  go("assistant.tabs", "/studio/more/assistant", ["nav.more", "more.assistant"], "showMe.assistant.tabs.label", { module: "assistant", pointOnly: true }),
  change("features.switches", "/studio/more/features", ["nav.more", "more.features"], "showMe.features.switches.label"),

  // Your data & AI, privacy and connecting an assistant.
  change("data.download", "/studio/more/data", toData, "data.card.download"),
  go("data.import", "/studio/more/data", toData, "data.card.import"),
  go("data.privacy", "/studio/more/data", toData, "data.card.privacyOpen"),
  go("data.assistant", "/studio/more/data", toData, "data.card.assistantDetails"),
  go("privacy.review", "/studio/more/privacy", [...toData, "data.privacy"], "showMe.privacy.review.label"),
  change("developers.connect", "/studio/more/advanced/developers", [...toData, "data.assistant"], "showMe.developers.connect.label"),

  // Settings and its pages.
  go("settings.salon", SETTINGS, toSettings, "settings.section.salon"),
  go("settings.hours", SETTINGS, toSettings, "settings.section.hours"),
  go("settings.reminders", SETTINGS, toSettings, "settings.section.reminders"),
  go("settings.link", SETTINGS, toSettings, "settings.section.link"),
  change("settings.appearance", SETTINGS, toSettings, "settings.section.appearance"),
  go("settings.advanced", SETTINGS, toSettings, "nav.advanced"),
  change("salon.details", "/studio/more/settings/salon", [...toSettings, "settings.salon"], "showMe.salon.details.label"),
  change("hours.weekly", "/studio/more/settings/hours", [...toSettings, "settings.hours"], "settings.hours"),
  change("hours.closed-days", "/studio/more/settings/hours", [...toSettings, "settings.hours"], "closed.add"),
  change("reminders.rules", "/studio/more/settings/reminders", [...toSettings, "settings.reminders"], "showMe.reminders.rules.label"),
  change("link.copy", "/studio/more/settings/link", [...toSettings, "settings.link"], "share.copyLink"),
  go("link.open", "/studio/more/settings/link", [...toSettings, "settings.link"], "share.open"),
  change("link.address", "/studio/more/settings/link", [...toSettings, "settings.link"], "address.title"),

  // Advanced: what most salons never need.
  go("advanced.developers", ADVANCED, toAdvanced, "advanced.developers.open"),
  change("advanced.embed", ADVANCED, toAdvanced, "share.copyCode"),
  change("advanced.own-domain", ADVANCED, toAdvanced, "domain.title"),
  change("advanced.booking-language", ADVANCED, toAdvanced, "showMe.advanced.booking-language.label"),
  change("advanced.sms-price", ADVANCED, toAdvanced, "showMe.advanced.sms-price.label"),
  change("advanced.styling", ADVANCED, toAdvanced, "showMe.advanced.styling.label"),
  change("advanced.rooms", ADVANCED, toAdvanced, "resources.title"),
  change("advanced.support-access", ADVANCED, toAdvanced, "support.title"),
  change("advanced.labs", ADVANCED, toAdvanced, "labs.title"),
  change("advanced.pack", ADVANCED, toAdvanced, "showMe.advanced.pack.label"),
  change("advanced.staff-preview", ADVANCED, toAdvanced, "role.preview"),
  change("advanced.start-over", ADVANCED, toAdvanced, "settings.startOver"),
  change("advanced.reset-demo", ADVANCED, toAdvanced, "settings.reset"),
];

const byId = new Map(HELP_MAP.map((entry) => [entry.id, entry]));

export function helpEntry(id: string): HelpEntry | undefined {
  return byId.get(id);
}

/** The entries "Show me" steps through for `id`: its path, then itself. */
export function helpSteps(id: string): HelpEntry[] {
  const entry = byId.get(id);
  if (!entry) return [];
  return [...entry.path.flatMap((step) => byId.get(step) ?? []), entry];
}
