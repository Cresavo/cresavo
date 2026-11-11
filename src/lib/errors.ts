import { ZodError } from "zod";

// Only literal messages owned by this codebase may cross a trust boundary.
const publicMessages = ["Tjänsten finns inte", "Tiden är inte tillgänglig",
  "Ogiltig sidmarkör för datumintervallet", "Utkastet finns inte"] as const;
type PublicMessage = typeof publicMessages[number];

export class DomainError extends Error {
  constructor(message: PublicMessage) { super(message); }
}

export function safeFailure(error: unknown) {
  if (error instanceof DomainError && publicMessages.includes(error.message as PublicMessage))
    return { status: 400, message: error.message };
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
