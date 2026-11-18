/** A received webhook as the route hands it to an adapter. Header names are lower case; the body is the raw text, never re-serialised. */
export interface WebhookRequest {
  /** The full public URL the provider called (some signatures cover it). */
  url: string;
  method: string;
  headers: Record<string, string>;
  rawBody: string;
  /** Seconds since the epoch; injected so tests and replay checks are deterministic. */
  nowSeconds?: number;
}
