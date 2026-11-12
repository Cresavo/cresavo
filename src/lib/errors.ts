import { ZodError } from "zod";

// Only literal messages owned by this codebase may cross a trust boundary.
const publicMessages = [
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
    readonly status: 400 | 403 | 404 | 409 | 429 = 400,
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
