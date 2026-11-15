import Link from "next/link";
import { DateTime } from "luxon";
import { getAdminContext } from "@/lib/auth";
import { adminBookingFilter } from "@/lib/domain";
import { listCalendar } from "@/lib/calendar";
import { listStaff } from "@/lib/workspace-config";
import { dateSchema } from "@/lib/validation";
import { DomainError, pageDataFailure } from "@/lib/errors";
import { ZONE } from "@/lib/time";
import AdminActions from "./ui";
import AdminHeader from "./header";
import Calendar from "./calendar";
import DemoEntry from "../demo-entry";
import { demoAccessEnabled } from "@/lib/demo-access";
import { ReturnLink } from "../components/context-link";
import { returnContext } from "@/lib/navigation-context";
import { getLocale } from "@/lib/locale-server";
import { text } from "@/lib/locale";
import { presentationError } from "@/lib/presentation-errors";
export const dynamic = "force-dynamic";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    view?: string;
    staffId?: string;
    status?: string;
    cursor?: string;
    from?: string;
    to?: string;
    returnTo?: string;
    returnKey?: string;
  }>;
}) {
  const locale = await getLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const admin = await getAdminContext();
  if (!admin)
    return (
      <main className="login-page">
        <Link prefetch={false} href="/">
          {t("Customer booking", "Bokningssidan")}
        </Link>
        <p className="eyebrow">SALONG EKO / DEMO</p>
        <h1>{t("Your workspace", "Salongens arbetsyta")}</h1>
        <p>
          {t(
            "Manage appointments, treatments, your team and working hours.",
            "Här ser du bokningar och ändrar behandlingar, personal och arbetstider.",
          )}
        </p>
        {demoAccessEnabled() ? (
          <>
            <DemoEntry />
            <details>
              <summary>
                {t("Administrator login", "Vanlig admininloggning")}
              </summary>
              <AdminActions mode="login" />
            </details>
          </>
        ) : (
          <AdminActions mode="login" />
        )}
      </main>
    );
  const params = await searchParams;
  let error: string | null = null;
  const today = DateTime.now().setZone(ZONE).toISODate()!;
  let date = dateSchema.safeParse(params.date).success ? params.date! : today;
  if (params.date && !dateSchema.safeParse(params.date).success)
    error = "Ogiltigt datum. Visar idag.";
  if (params.from || params.to) {
    const legacy = adminBookingFilter({
      ...(params.from && { from: params.from }),
      ...(params.to && { to: params.to }),
    });
    error = legacy.error;
    date = legacy.filter.from;
  }
  const view = params.view === "week" ? "week" : "day";
  const staff = await listStaff(undefined, true).catch(pageDataFailure);
  let staffId = typeof params.staffId === "string" ? params.staffId : "";
  if (staffId && !staff.some((p) => p.id === staffId)) {
    staffId = "";
    error = "Medarbetaren finns inte i den här kalendern.";
  }
  const selected = DateTime.fromISO(date, { zone: ZONE });
  const from = (
    view === "week" ? selected.startOf("week") : selected
  ).toISODate()!;
  const to = (view === "week" ? selected.endOf("week") : selected).toISODate()!;
  const status = params.status === "all" ? "all" : "confirmed";
  const filter = {
    from,
    to,
    limit: 100,
    status,
    ...(staffId && { staffId }),
    ...(typeof params.cursor === "string" &&
      params.cursor.length <= 128 && { cursor: params.cursor }),
  };
  const loaded = await listCalendar(filter)
    .then((result) => ({ result, cursorError: null as string | null }))
    .catch(async (cause) => {
      if (
        cause instanceof DomainError &&
        cause.message === "Ogiltig sidmarkör för datumintervallet"
      ) {
        return {
          result: await listCalendar({ ...filter, cursor: undefined }).catch(
            pageDataFailure,
          ),
          cursorError: cause.message,
        };
      }
      return pageDataFailure(cause);
    });
  return (
    <>
      <AdminHeader email={admin.email} active="calendar" />
      <main className="admin-workspace">
        {params.returnTo && (
          <ReturnLink
            context={returnContext(params, "/admin/overview")}
            fallback="/admin/overview"
          />
        )}
        {(error || loaded.cursorError) && (
          <p role="alert" className="form-error">
            {presentationError(error || loaded.cursorError, locale)}
          </p>
        )}
        <Calendar
          date={date}
          view={view}
          staffId={staffId}
          staff={staff}
          bookings={loaded.result.bookings}
          nextCursor={loaded.result.nextCursor}
          status={status}
          context={
            params.returnTo
              ? returnContext(params, "/admin/overview")
              : undefined
          }
        />
      </main>
    </>
  );
}
