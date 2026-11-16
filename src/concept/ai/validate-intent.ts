import type { IntentContext, IntentResult } from "../intent";

export function hasValidIntentReferences(output: IntentResult, context: IntentContext): boolean {
  const { params } = output;
  if (params.customerId && !context.customers.some(item => item.id === params.customerId)) return false;
  if (params.serviceId && !context.services.some(item => item.id === params.serviceId)) return false;
  if (params.staffId && !context.staff.some(item => item.id === params.staffId)) return false;
  if (params.bookingId && !context.bookings.some(item => item.id === params.bookingId && (!params.customerId || item.customerId === params.customerId))) return false;
  if (params.start && params.end && params.start >= params.end) return false;
  return true;
}
