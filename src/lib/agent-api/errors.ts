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
  rate_limited: { status: 429, message: "Too many requests. Retry later." },
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
