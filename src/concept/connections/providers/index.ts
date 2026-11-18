import type { PortName } from "../core";
import { definition as fortnox } from "./accounting/fortnox";
import { definition as visma } from "./accounting/visma";
import { definition as googleCalendar } from "./calendar/google";
import { definition as microsoftCalendar } from "./calendar/microsoft";
import type { ProviderDefinition } from "./definition";
import { definition as postmark } from "./email/postmark";
import { definition as resend } from "./email/resend";
import { bokio, metaAds, smtp } from "./interface-only";
import { definition as googleReserve } from "./listing/google-reserve";
import { definition as stripe } from "./payments/stripe";
import { definition as meta } from "./social/meta";
import { definition as elks } from "./sms/elks46";
import { definition as twilio } from "./sms/twilio";

export type { ProviderDefinition } from "./definition";

/** Every provider, global ones first. Add a new adapter here (docs/integrations/README.md, "Add a new provider"). */
export const PROVIDERS: readonly ProviderDefinition[] = [
  twilio, elks,
  resend, postmark, smtp,
  stripe,
  fortnox, visma, bokio,
  googleCalendar, microsoftCalendar,
  googleReserve,
  meta,
  metaAds,
] as ProviderDefinition[];

export function providerDefinition(port: PortName, provider: string): ProviderDefinition | undefined {
  return PROVIDERS.find((d) => d.info.port === port && d.info.provider === provider);
}
