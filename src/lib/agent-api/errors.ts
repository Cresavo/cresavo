// Stable, English, machine-readable errors for the agent API. Messages are
// literals owned by this file; nothing from a request or exception is echoed.
export const agentApiErrors = {
  unauthorized: { status: 401, message: "A valid API key is required." },
  forbidden_scope: { status: 403, message: "This API key lacks the required scope." },
  forbidden_business: { status: 403, message: "This API key is not authorised for that business." },
  business_not_found: { status: 404, message: "Business not found." },
  service_not_found: { status: 404, message: "Service not found." },
  staff_not_found: { status: 404, message: "Staff member not found for this service." },
  invalid_request: { status: 400, message: "Check the request parameters." },
  range_too_large: { status: 400, message: "The date range may cover at most 14 days." },
  booking_not_found: { status: 404, message: "Booking not found." },
  slot_unavailable: { status: 409, message: "That time is no longer available. Fetch availability again." },
  stale_service: { status: 409, message: "The service has changed. Fetch services again and resend serviceVersion." },
  idempotency_conflict: { status: 409, message: "This Idempotency-Key was already used with different booking details." },
  idempotency_key_required: { status: 400, message: "Send an Idempotency-Key header (1-64 characters A-Z a-z 0-9 _ -)." },
  confirmation_required: { status: 400, message: "Set confirmed: true only after the person has approved this exact booking." },
  mandate_required: { status: 400, message: "A server-issued synthetic booking mandate is required." },
  mandate_denied: { status: 403, message: "The booking is outside the authorised mandate." },
  synthetic_contact_required: { status: 400, message: "The sandbox only accepts synthetic customer emails ending in @example.test." },
  rate_limited: { status: 429, message: "Too many requests. Retry later." },
  provider_configuration_invalid: { status: 503, message: "The salon is not configured for gateway operations." },
  internal_error: { status: 500, message: "An internal error occurred." },
} as const;
export type AgentApiErrorCode = keyof typeof agentApiErrors;

export class AgentApiError extends Error {
  constructor(
    readonly code: AgentApiErrorCode,
    readonly retryAfter?: number,
  ) {
    super(agentApiErrors[code].message);
  }
  get status() {
    return agentApiErrors[this.code].status;
  }
}
