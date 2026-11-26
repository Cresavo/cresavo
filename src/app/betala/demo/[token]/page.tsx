import type { Metadata, Viewport } from "next";
import { translate } from "@/concept/i18n";
import { PayPage } from "@/concept/register/pay-page";
import { demoBusinessName, payRequestStatus, readPayRequest } from "@/concept/register/pay-request";
import { parseLocale } from "@/lib/locale";
import { getLocale } from "@/lib/locale-server";
import { PAGE_FONTS } from "../../../page-fonts";
import "../../../studio/studio.css";

// Where the demo register's QR code leads: the customer's phone pays the
// request here, by card or Swish, both simulated. The address carries the
// signed request (amount, currency, methods, sample business), nothing else.

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string | string[] }> };

export const dynamic = "force-dynamic";

async function read({ params, searchParams }: Props) {
  const [{ token }, { lang }] = await Promise.all([params, searchParams]);
  const language = parseLocale(typeof lang === "string" ? lang : undefined) ?? (await getLocale());
  return { token, language, request: readPayRequest(token) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { language, request } = await read(props);
  return {
    title: request ? translate(language, "pay.documentTitle", { salon: demoBusinessName(request.business)! }) : translate(language, "pay.invalid.title"),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The neutral tenant chrome, as on a booking page (tenant-theme.css).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f5" },
    { media: "(prefers-color-scheme: dark)", color: "#141415" },
  ],
};

export default async function Page(props: Props) {
  const { token, language, request } = await read(props);
  const status = request ? payRequestStatus(request).status : "invalid";
  return (
    <div className={`studio-root booking-boundary ${PAGE_FONTS}`}>
      <PayPage
        token={token} language={language} initial={status === "paid" ? "used" : status}
        request={request && {
          salon: demoBusinessName(request.business)!, amountMinor: request.amountMinor, currency: request.currency, methods: request.methods,
          reference: `DEMO-${request.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase()}`,
        }}
      />
    </div>
  );
}
