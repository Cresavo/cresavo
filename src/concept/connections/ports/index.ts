import type { AccountingPort } from "./accounting";
import type { AdsPort } from "./ads";
import type { CalendarPort } from "./calendar";
import type { EmailPort } from "./email";
import type { ListingPort } from "./listing";
import type { PaymentsPort } from "./payments";
import type { SmsPort } from "./sms";
import type { SocialPort } from "./social";

export interface PortMap {
  sms: SmsPort;
  email: EmailPort;
  payments: PaymentsPort;
  accounting: AccountingPort;
  calendar: CalendarPort;
  listing: ListingPort;
  social: SocialPort;
  ads: AdsPort;
}
