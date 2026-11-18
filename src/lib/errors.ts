import { ZodError } from "zod";

// Only literal messages owned by this codebase may cross a trust boundary.
const publicMessages = [
  "Check the previous booking attempt first.",
  "The previous attempt was declined. Choose another time and confirm again.",
  "This demo profile cannot access the booking.",
  "There is no active booking to add to the calendar.",
  "Choose a date from the past week through the next 28 days.",
  "Choose an active team member.",
  "Choose a treatment this team member provides.",
  "Choose a date within the next 28 days.",
  "Choose an available treatment.",
  "No team member provides the selected treatment.",
  "The details have changed. Preview them again before confirming.",
  "Use a fictional example.test email address in this demo.",
  "This POC supports up to 1,000 linked bookings. This record exceeds that limit.",
  "The export has changed. Start a new export to continue.",
  "This export page is no longer valid. Start a new export.",
  "Handle upcoming or ongoing bookings before removing contact details.",
  "Contact details were removed. Create a new customer record for a new contact.",
  "This suggestion is out of date. Refresh the overview.",
  "This suggestion was already handled with different terms. Refresh the overview.",
  "Access denied.",
  "This POC has reached its resource limit.",
  "This team member does not provide the selected treatment.",
  "The details have changed. Refresh and review them again.",
  "This change affects existing bookings. Reschedule or cancel them first.",
  "Booking not found. Return to the calendar.",
  "Customer not found. Return to customers.",
  "Choose an active customer record.",
  "The search has changed. Return to the first page.",
  "The history has changed. Return to the first page.",
  "This booking is cancelled and cannot be rescheduled.",
  "The end date cannot be before the start date.",
  "A campaign can last up to 90 calendar days.",
  "This treatment is no longer available.",
  "That time is no longer available. Choose another time.",
  "This page does not match the date range. Showing the first page.",
  "Draft not found. Refresh the campaign list.",
  "Too many attempts. Please try again later.",
  "This booking attempt was already used with different details.",
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
    super("Too many attempts. Please try again later.", 429, 1);
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
    return { status: 400, message: "Check the details and try again." };
  // Never log the error, message, stack, cause, SQL, request or credentials.
  console.error("BOOKING_INTERNAL_ERROR");
  return { status: 500, message: "Something went wrong. Try again." };
}

// Scope this to data loading, not Next redirect/notFound control flow.
export function pageDataFailure(error: unknown): never {
  safeFailure(error);
  throw new Error("Something went wrong. Try again.");
}
