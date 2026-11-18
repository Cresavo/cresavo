// Fortnox API v3 vouchers (regional adapter, Nordics) over plain fetch.
// Sources (checked 2026-11):
// - Vouchers: https://api.fortnox.se/apidocs/#tag/Vouchers, https://www.fortnox.se/developer/guides-and-good-to-know/best-practices/vouchers
// - OAuth (token endpoint, Basic client auth): https://www.fortnox.se/developer/authorization/get-access-token, refresh: https://www.fortnox.se/developer/authorization/get-refresh-token
// - Scopes (bookkeeping): https://www.fortnox.se/developer/guides-and-good-to-know/scopes
// - Errors (ErrorInformation{error,message,code}): https://www.fortnox.se/developer/guides-and-good-to-know/responses
// - Rate limit 25 requests / 5 s per client and tenant: https://www.fortnox.se/developer/guides-and-good-to-know/rate-limits-for-fortnox-api
// - Pricing: https://www.fortnox.se/produkt/prislista (Integration licence SEK 189/month excl. VAT, verify)
// verify: no idempotency key for vouchers. Our reference goes into the description so a duplicate can be found and reversed.
// verify: Fortnox rotates refresh tokens on every use; without a writable per-business store (goal 11) the new one is lost.
import { connectionError, fail, majorString, ok } from "../../core";
import { isBalanced, type AccountingPort } from "../../ports/accounting";
import { field, request, text, type Fetcher } from "../../server/http";
import { accessToken, type OAuthClient } from "../../server/oauth";
import type { ProviderDefinition } from "../definition";

const PROVIDER = "fortnox";

const codeOf = (data: unknown) => ({ providerCode: field(data, "ErrorInformation", "code") ?? field(data, "ErrorInformation", "Code") });

export function fortnoxAccounting(options: { oauth: OAuthClient; series?: string; fetch: Fetcher }): AccountingPort {
  const context = { port: "accounting" as const, provider: PROVIDER, fetch: options.fetch, secrets: [options.oauth.clientSecret, options.oauth.refreshToken] };
  return {
    info: definition.info,
    async postVoucher(voucher) {
      if (voucher.currency !== "SEK") return fail(connectionError("accounting", PROVIDER, "not_supported")); // Fortnox books in SEK.
      if (!isBalanced(voucher.rows) || !/^\d{4}-\d{2}-\d{2}$/.test(voucher.date) || !voucher.reference || voucher.rows.some((r) => !/^\d{4}$/.test(r.account))) {
        return fail(connectionError("accounting", PROVIDER, "invalid_input"));
      }
      const token = await accessToken(options.oauth, "accounting", PROVIDER, options.fetch);
      if (!token.ok) return fail(token.error);
      const series = voucher.series ?? options.series ?? "A";
      const result = await request(context, "https://api.fortnox.se/3/vouchers", {
        method: "POST",
        headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          Voucher: {
            VoucherSeries: series,
            TransactionDate: voucher.date,
            Description: `${voucher.description} [${voucher.reference}]`.slice(0, 200),
            VoucherRows: voucher.rows.map((row) => ({
              Account: Number(row.account),
              Debit: Number(majorString({ amountMinor: row.debitMinor, currency: "SEK" })),
              Credit: Number(majorString({ amountMinor: row.creditMinor, currency: "SEK" })),
              ...(row.description ? { TransactionInformation: row.description.slice(0, 100) } : {}),
            })),
          },
        }),
      }, codeOf);
      if (!result.ok) return fail(result.error);
      const number = field(result.data, "Voucher", "VoucherNumber");
      const returned = text(field(result.data, "Voucher", "VoucherSeries")) ?? series;
      if (typeof number !== "number" && typeof number !== "string") return fail(connectionError("accounting", PROVIDER, "unknown"));
      const id = `${returned}${number}`;
      return ok({ id, series: returned }, "delivered", null, id);
    },
  };
}

export const definition: ProviderDefinition<"accounting"> = {
  info: { port: "accounting", provider: PROVIDER, kind: "live", region: "Nordics", capabilities: ["voucher", "daily-sales"], secrets: ["FORTNOX_CLIENT_ID", "FORTNOX_CLIENT_SECRET", "FORTNOX_REFRESH_TOKEN"] },
  secrets: ["FORTNOX_CLIENT_ID", "FORTNOX_CLIENT_SECRET", "FORTNOX_REFRESH_TOKEN"],
  settings: ["FORTNOX_VOUCHER_SERIES"],
  create: ({ secrets, settings, fetch }) =>
    fortnoxAccounting({
      oauth: { tokenUrl: "https://apps.fortnox.se/oauth-v1/token", clientId: secrets.FORTNOX_CLIENT_ID, clientSecret: secrets.FORTNOX_CLIENT_SECRET, refreshToken: secrets.FORTNOX_REFRESH_TOKEN, clientAuth: "basic" },
      series: settings.FORTNOX_VOUCHER_SERIES,
      fetch,
    }),
};
