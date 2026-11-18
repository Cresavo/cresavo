// Visma eAccounting / eEkonomi (Spiris) API v2 vouchers (regional adapter, Nordics) over plain fetch.
// Sources (checked 2026-11):
// - Authentication and scopes (ea:api ea:accounting offline_access): https://developer.vismaonline.com/docs/authentication
// - Voucher fields (VoucherDate, VoucherText, Rows[AccountNumber, DebitAmount, CreditAmount]):
//   https://community.visma.com/xqnef94594/attachments/xqnef94594/IN_MA_eAccountingAPI_knowledgebase/35/17/6%20-%20Frequently%20used%20endpoints.pdf#page=3
// - API reference: https://eaccountingapi.vismaonline.com/scalar/v2
// - Errors (ErrorCode, DeveloperErrorMessage, ErrorId): https://developer.vismaonline.com/docs/error-handling-copy
// - Rate limit 600 requests/min per client and endpoint (429, ErrorCode 4010): https://developer.vismaonline.com/docs/rate-limits-copy
// - Pricing: https://www.spiris.se/priser (Integration add-on SEK 119/month, verify)
// verify: POST /v2/vouchers is used by integrations but not readable in the official reference; /v2/voucherdrafts + /convert is the documented alternative.
// verify: no idempotency key; our reference goes into VoucherText.
import { connectionError, fail, majorString, ok } from "../../core";
import { isBalanced, type AccountingPort } from "../../ports/accounting";
import { field, request, text, type Fetcher } from "../../server/http";
import { accessToken, type OAuthClient } from "../../server/oauth";
import type { ProviderDefinition } from "../definition";

const PROVIDER = "visma-eaccounting";

const codeOf = (data: unknown, status: number) => {
  const code = field(data, "ErrorCode");
  return status === 429 || code === 4010 ? { code: "rate_limited" as const, providerCode: code } : { providerCode: code };
};

export function vismaAccounting(options: { oauth: OAuthClient; fetch: Fetcher }): AccountingPort {
  const context = { port: "accounting" as const, provider: PROVIDER, fetch: options.fetch, secrets: [options.oauth.clientSecret, options.oauth.refreshToken] };
  return {
    info: definition.info,
    async postVoucher(voucher) {
      if (voucher.currency !== "SEK" && voucher.currency !== "NOK") return fail(connectionError("accounting", PROVIDER, "not_supported")); // verify: home currency per market
      if (!isBalanced(voucher.rows) || !/^\d{4}-\d{2}-\d{2}$/.test(voucher.date) || !voucher.reference || voucher.rows.some((r) => !/^\d{4}$/.test(r.account))) {
        return fail(connectionError("accounting", PROVIDER, "invalid_input"));
      }
      const token = await accessToken(options.oauth, "accounting", PROVIDER, options.fetch);
      if (!token.ok) return fail(token.error);
      const amount = (minor: number) => Number(majorString({ amountMinor: minor, currency: voucher.currency }));
      const result = await request(context, "https://eaccountingapi.vismaonline.com/v2/vouchers", {
        method: "POST",
        headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          VoucherDate: voucher.date,
          VoucherText: `${voucher.description} [${voucher.reference}]`.slice(0, 200),
          Rows: voucher.rows.map((row) => ({
            AccountNumber: Number(row.account),
            ...(row.debitMinor > 0 ? { DebitAmount: amount(row.debitMinor) } : { CreditAmount: amount(row.creditMinor) }),
            ...(row.description ? { TransactionText: row.description.slice(0, 60) } : {}),
          })),
        }),
      }, codeOf);
      if (!result.ok) return fail(result.error);
      const id = text(field(result.data, "Id"));
      return id ? ok({ id }, "delivered", null, id) : fail(connectionError("accounting", PROVIDER, "unknown"));
    },
  };
}

export const definition: ProviderDefinition<"accounting"> = {
  info: { port: "accounting", provider: PROVIDER, kind: "live", region: "Nordics", capabilities: ["voucher", "daily-sales"], secrets: ["VISMA_CLIENT_ID", "VISMA_CLIENT_SECRET", "VISMA_REFRESH_TOKEN"] },
  secrets: ["VISMA_CLIENT_ID", "VISMA_CLIENT_SECRET", "VISMA_REFRESH_TOKEN"],
  settings: [],
  create: ({ secrets, fetch }) =>
    vismaAccounting({
      oauth: { tokenUrl: "https://identity.vismaonline.com/connect/token", clientId: secrets.VISMA_CLIENT_ID, clientSecret: secrets.VISMA_CLIENT_SECRET, refreshToken: secrets.VISMA_REFRESH_TOKEN, clientAuth: "basic" },
      fetch,
    }),
};
