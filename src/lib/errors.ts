import { ZodError } from "zod";

// Only literal messages owned by this codebase may cross a trust boundary.
const publicMessages = [
  "Kontrollera det tidigare bokningsförsöket först.",
  "Det tidigare försöket nekades. Välj en ny tid och bekräfta igen.",
  "Bokningen kan inte visas med den här demoprofilen.",
  "Ingen aktiv bokning att lägga i kalendern.",
  "Välj en dag från förra veckan till de kommande 28 dagarna.",
  "Välj en aktiv medarbetare.",
  "Välj en behandling som medarbetaren utför.",
  "Välj en dag inom de kommande 28 dagarna.",
  "Välj en tillgänglig behandling.",
  "Ingen utförare finns för den valda behandlingen.",
  "Underlaget har ändrats. Förhandsgranska igen.",
  "POC-flödet tillåter endast syntetiska testadresser.",
  "Underlaget är för stort för POC-flödet. Högst 1000 kopplade bokningar stöds.",
  "Fortsättningen kräver samma exportunderlag.",
  "Ogiltig sidmarkör för kundexporten.",
  "Hantera kommande eller pågående bokningar innan kontaktuppgifterna tas bort.",
  "Kontaktuppgifterna är borttagna. Skapa ett nytt kundkort för en ny kontakt.",
  "Förslaget är inte aktuellt. Uppdatera översikten.",
  "Förslaget har redan hanterats med andra villkor.",
  "Åtkomst nekad",
  "För många resurser",
  "Medarbetaren kan inte utföra behandlingen",
  "Uppgifterna har ändrats. Läs in på nytt.",
  "Ändringen berör bokade tider. Flytta eller avboka dem först.",
  "Bokningen finns inte",
  "Kunden finns inte",
  "Välj ett aktivt kundkort.",
  "Sökningen har ändrats. Börja från första sidan.",
  "Historiken har ändrats. Börja från första sidan.",
  "Bokningen är avbokad och kan inte flyttas.",
  "Slutdatum får inte vara före startdatum.",
  "Kampanjen får gälla högst 90 kalenderdagar.",
  "Tjänsten finns inte",
  "Tiden är inte tillgänglig",
  "Ogiltig sidmarkör för datumintervallet",
  "Utkastet finns inte",
  "För många försök. Försök igen senare.",
  "Bokningsnyckeln har redan använts med andra uppgifter.",
] as const;
type PublicMessage = (typeof publicMessages)[number];

export class DomainError extends Error {
  constructor(
    message: PublicMessage,
    readonly status: 400 | 403 | 404 | 409 | 413 | 429 = 400,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

// No password was checked. Callers may return a reserved attempt to the client.
export class PasswordCapacityError extends DomainError {
  constructor() {
    super("För många försök. Försök igen senare.", 429, 1);
  }
}

export function safeFailure(error: unknown) {
  if (
    error instanceof DomainError &&
    publicMessages.includes(error.message as PublicMessage)
  )
    return {
      status: error.status,
      message: error.message,
      retryAfter: error.retryAfter,
    };
  if (
    error instanceof ZodError &&
    error.issues.length === 1 &&
    error.issues[0].code === "custom" &&
    publicMessages.includes(error.issues[0].message as PublicMessage)
  )
    return { status: 400, message: error.issues[0].message };
  if (error instanceof ZodError || error instanceof SyntaxError)
    return { status: 400, message: "Kontrollera uppgifterna" };
  // Never log the error, message, stack, cause, SQL, request or credentials.
  console.error("BOOKING_INTERNAL_ERROR");
  return { status: 500, message: "Ett fel inträffade" };
}

// Scope this to data loading, not Next redirect/notFound control flow.
export function pageDataFailure(error: unknown): never {
  safeFailure(error);
  throw new Error("Ett fel inträffade");
}
