// Contract-only adapters: the provider is known and documented, but no live
// code exists yet. Every call answers not_supported, so selecting one can never
// send anything. See docs/integrations/README.md for what each still needs.
import { connectionError, fail, type AdapterInfo } from "../core";
import type { AccountingPort } from "../ports/accounting";
import type { AdsPort } from "../ports/ads";
import type { EmailPort } from "../ports/email";
import type { ProviderDefinition } from "./definition";

const none = (info: AdapterInfo) => async () => fail(connectionError(info.port, info.provider, "not_supported"));

// SMTP: nodemailer is not a dependency; a raw SMTP client is out of scope. Settings would be
// SMTP_HOST, SMTP_PORT, SMTP_USER and the secret SMTP_PASSWORD.
const smtpInfo: EmailPort["info"] = { port: "email", provider: "smtp", kind: "interface", capabilities: [], secrets: ["SMTP_PASSWORD"] };
export const smtp: ProviderDefinition<"email"> = {
  info: { ...smtpInfo, port: "email" as const },
  secrets: [],
  settings: [],
  create: (): EmailPort => ({ info: smtpInfo, send: none(smtpInfo) }),
};

// Bokio (regional, Nordics): public Company API with OAuth2, POST /v1/companies/{companyId}/journal-entries
// (https://docs.bokio.se/reference/post-journalentry). The item schema is not confirmed, so no live code yet.
const bokioInfo: AccountingPort["info"] = { port: "accounting", provider: "bokio", kind: "interface", region: "Nordics", capabilities: [], secrets: ["BOKIO_ACCESS_TOKEN"] };
export const bokio: ProviderDefinition<"accounting"> = {
  info: { ...bokioInfo, port: "accounting" as const },
  secrets: [],
  settings: [],
  create: (): AccountingPort => ({ info: bokioInfo, postVoucher: none(bokioInfo) }),
};

// Meta Marketing API: POST /v27.0/act_{ad_account_id}/campaigns with status=PAUSED
// (https://developers.facebook.com/docs/graph-api/reference/adcampaigngroup/). Drafts only, later.
const metaAdsInfo: AdsPort["info"] = { port: "ads", provider: "meta-ads", kind: "interface", capabilities: [], secrets: ["META_ADS_ACCESS_TOKEN"] };
export const metaAds: ProviderDefinition<"ads"> = {
  info: { ...metaAdsInfo, port: "ads" as const },
  secrets: [],
  settings: [],
  create: (): AdsPort => ({ info: metaAdsInfo, createDraft: none(metaAdsInfo) }),
};
