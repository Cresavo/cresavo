"use client";

import { CalendarCheck, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "../i18n";
import { formatDayLong, formatDuration, formatTime } from "../i18n/format";
import { useServerSalon } from "../server-salon";
import { ButtonLink } from "../ui/button";
import { Card } from "../ui/card";
import { Bone, SkeletonCard, SkeletonGroup } from "../ui/feedback";
import { captureLinkToken } from "./link-token";
import { bookingHome } from "./links";
import { ManageBooking } from "./manage-booking";
import type { PublicBookingView } from "./public-booking-view";

type Loaded = { state: "loading" } | { state: "missing" } | { state: "link-needed" } | { state: "ready"; view: PublicBookingView; token: string };

const TITLES = { booked: "booking.confirmation.title", completed: "booking.confirmation.completed", cancelled: "booking.confirmation.cancelled", noshow: "booking.confirmation.noshow" } as const;

/**
 * A booking on a salon's own page, for the holder of the link in the
 * confirmation e-mail. The token is in the address fragment, which the browser
 * never sends; it is posted once and kept out of the address bar (link-token.tsx).
 */
export function ServerBookingView({ slug, id }: { slug: string; id: string }) {
  const salon = useServerSalon();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

  useEffect(() => {
    const token = captureLinkToken();
    const controller = new AbortController();
    const load: Promise<Loaded> = !token ? Promise.resolve({ state: "link-needed" }) : fetch(`/api/public/salons/${encodeURIComponent(slug)}/bookings/${encodeURIComponent(id)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), cache: "no-store", signal: controller.signal,
    }).then((response) => response.ok ? response.json() as Promise<{ booking: PublicBookingView }> : null)
      .then((body): Loaded => body ? { state: "ready", view: body.booking, token: token! } : { state: "missing" });
    load.catch((): Loaded => ({ state: "missing" })).then((result) => controller.signal.aborted || setLoaded(result));
    return () => controller.abort();
  }, [slug, id]);

  const back = <ButtonLink href={bookingHome(slug)}>{t("booking.notFound.action")}</ButtonLink>;
  if (loaded.state === "loading") {
    return (
      <SkeletonGroup className="mx-auto max-w-lg space-y-5">
        <Bone className="mx-auto h-8 w-2/3" />
        <SkeletonCard lines={3} />
      </SkeletonGroup>
    );
  }
  if (loaded.state !== "ready") {
    return (
      <Card className="mx-auto max-w-lg space-y-4 p-6 text-center">
        <p className="text-h3 font-semibold">{t(loaded.state === "missing" ? "booking.notFound.title" : "bookingView.needLink")}</p>
        {loaded.state === "missing" && <p className="text-text-secondary">{t("bookingView.notFound")}</p>}
        {back}
      </Card>
    );
  }
  const { view } = loaded;
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-center text-h1 font-semibold tracking-tight">{t(TITLES[view.status])}</h1>
      <Card className="space-y-4 p-5">
        <div>
          <p className="text-h3 font-semibold">{view.treatment}</p>
          <p className="mt-1 flex items-center gap-2 text-body">
            <CalendarCheck size={16} className="shrink-0 text-action" />
            {formatDayLong(view.date)}, {formatTime(view.start)}–{formatTime(view.start + view.duration)}
          </p>
        </div>
        <p className="text-meta text-text-secondary">{t("booking.withStaff", { name: view.staffFirstName })} · {formatDuration(view.duration)}</p>
        <p className="flex items-start gap-2 text-meta text-text-secondary">
          <MapPin size={16} className="mt-1 shrink-0" />
          {[salon?.salon.name, view.salon.address].filter(Boolean).join(", ")}
        </p>
      </Card>
      <ManageBooking slug={slug} id={id} token={loaded.token} view={view} onChanged={(changed) => setLoaded({ ...loaded, view: changed })} />
      <ButtonLink href={bookingHome(slug)} variant="secondary">{t("booking.backToSalon")}</ButtonLink>
    </div>
  );
}
