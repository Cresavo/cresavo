import type { Locale } from "./locale";

// UI translations only. The server's public error strings and status codes stay stable.
const english: Record<string, string> = {
  "Underlaget har ändrats. Förhandsgranska igen.": "The details have changed. Preview them again before confirming.",
  "Underlaget är för stort för POC-flödet. Högst 1000 kopplade bokningar stöds.": "This POC supports up to 1,000 linked bookings. This record exceeds that limit.",
  "Fortsättningen kräver samma exportunderlag.": "The export has changed. Start a new export to continue.",
  "Ogiltig sidmarkör för kundexporten.": "This export page is no longer valid. Start a new export.",
  "Hantera kommande eller pågående bokningar innan kontaktuppgifterna tas bort.": "Handle upcoming or ongoing bookings before removing contact details.",
  "Kontaktuppgifterna är borttagna. Skapa ett nytt kundkort för en ny kontakt.": "Contact details were removed. Create a new customer record for a new contact.",
  "Förslaget är inte aktuellt. Uppdatera översikten.": "This suggestion is out of date. Refresh the overview.",
  "Förslaget har redan hanterats med andra villkor.": "This suggestion was already handled with different terms. Refresh the overview.",
  "Ändringen berör bokade tider. Flytta eller avboka dem först.": "This change affects existing bookings. Reschedule or cancel them first.",
  "Bokningen finns inte": "Booking not found. Return to the calendar.",
  "Kunden finns inte": "Customer not found. Return to customers.",
  "Välj ett aktivt kundkort.": "Choose an active customer record.",
  "Sökningen har ändrats. Börja från första sidan.": "The search has changed. Return to the first page.",
  "Historiken har ändrats. Börja från första sidan.": "The history has changed. Return to the first page.",
  "Bokningen är avbokad och kan inte flyttas.": "This booking is cancelled and cannot be rescheduled.",
  "Slutdatum får inte vara före startdatum.": "The end date cannot be before the start date.",
  "Kampanjen får gälla högst 90 kalenderdagar.": "A campaign can last up to 90 calendar days.",
  "Ogiltig sidmarkör för datumintervallet": "This page does not match the date range. Showing the first page.",
  "Ogiltigt datum. Visar idag.": "Invalid date. Showing today.",
  "Medarbetaren finns inte i den här kalendern.": "This team member is not in this calendar.",
  "Utkastet finns inte": "Draft not found. Refresh the campaign list.",
  "För många resurser": "This POC has reached its resource limit.",
  "Översikten kunde inte hämtas. Försök uppdatera igen.":
    "Could not load the overview. Try refreshing again.",
  "Anslutningen avbröts. Försök igen; samma åtgärd skapar inte dubbla utkast.":
    "Connection interrupted. Retry the same action; it will not create duplicate drafts.",
  "Svaret kunde inte läsas. Uppdatera översikten eller försök igen.":
    "Could not read the response. Refresh the overview or try again.",
  "Åtgärden kunde inte slutföras. Uppdatera översikten.":
    "Could not complete the action. Refresh the overview.",
  "Bokningen kunde inte hämtas.": "Could not load the booking. Try again.",
  "Bokningen kunde inte hämtas. Försök igen.":
    "Could not load the booking. Try again.",
  "Ändringen kunde inte sparas.":
    "Could not save the change. Your details are kept.",
  "Svaret kunde inte hämtas. Försök igen med samma uppgifter.":
    "Could not retrieve the result. Retry with the same details.",
  "Fel inloggningsuppgifter": "Incorrect login details.",
  "Tiden är inte tillgänglig":
    "That time is no longer available. Choose another time.",
  "Kontrollera uppgifterna": "Check the details and try again.",
  "Ett fel inträffade": "Something went wrong. Try again.",
  "För många försök. Försök igen senare.":
    "Too many attempts. Please try again later.",
  "Bokningsnyckeln har redan använts med andra uppgifter.":
    "This booking attempt was already used with different details.",
  "Åtkomst nekad": "Access denied.",
  "Otillåtet ursprung":
    "This request could not be accepted. Open the page and try again.",
  "Uppgifterna har ändrats. Läs in på nytt.":
    "The details have changed. Refresh and review them again.",
  "Tjänsten finns inte": "This treatment is no longer available.",
  "Medarbetaren kan inte utföra behandlingen":
    "This team member does not provide the selected treatment.",
  "POC-flödet tillåter endast syntetiska testadresser.":
    "Use a fictional example.test email address in this demo.",
  "Tiderna kunde inte hämtas. Försök igen.":
    "Could not load available times. Try again.",
  "Tiderna kunde inte hämtas.": "Could not load available times. Try again.",
  "Inga lediga tider inom de närmaste 60 dagarna. Välj en annan behandling eller medarbetare.":
    "No available times in the next 60 days. Try another treatment or team member.",
};
export function presentationError(message: unknown, locale: Locale): string {
  if (typeof message !== "string")
    return locale === "en"
      ? "Something went wrong. Try again."
      : "Ett fel inträffade";
  if (locale === "sv") return message;
  return Object.hasOwn(english, message)
    ? english[message]
    : "Could not complete this request. Check the details and try again.";
}
