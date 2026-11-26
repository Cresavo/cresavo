"use client";

import Link from "next/link";
import type { ReactNode, Ref } from "react";
import { CalendarCheck, Palette, Upload } from "lucide-react";
import { bookingHome } from "../../booking/links";
import { t } from "../../i18n";
import { ButtonLink, buttonClass } from "../../ui/button";
import { ListRow } from "../../ui/list-row";
import { PageHeader } from "../page-header";
import { useStudio } from "../use-studio";
import { recordPageSeen } from "./checklist";

/**
 * The finished salon: its real booking page to try as a customer would, one way on (the day) and a few things that
 * can wait. The salon lives in this browser, so nothing here offers its address for others to open; sharing stays
 * with Settings › Booking link, which says so.
 */
export function SetupFinish({ progress, titleRef }: { progress: ReactNode; titleRef: Ref<HTMLHeadingElement> }) {
  const { state } = useStudio();
  const { slug } = state.salon;
  const home = bookingHome(slug);
  // Opening the page from here counts as having checked it.
  const seen = () => recordPageSeen(slug);
  // One frame: under the title on a phone, beside everything from lg. The column is `contents` until then, so its
  // children and the frame share one flow and `order` places the frame.
  return <div className="flex flex-col gap-6 lg:mx-auto lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-x-12">
    <div className="contents lg:block lg:space-y-6">
      <div className="order-1">{progress}</div>
      <div className="order-2 -mb-6"><PageHeader tools={false} titleRef={titleRef} title={t("setup.ready")} subtitle={t("setup.readyHint")} /></div>
      <div className="order-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href={home + "#book"} onClick={seen} className={buttonClass("secondary", "md", "w-full sm:w-fit")}>
          <CalendarCheck aria-hidden size={18} />{t("setup.testBooking")}
        </Link>
        <Link href={home} onClick={seen} className={buttonClass("link", "md", "-ml-1 px-1")}>{t("setup.seePage")}</Link>
      </div>
      <div className="order-5"><ButtonLink href="/studio" size="lg" width="responsive">{t("setup.goToDay")}</ButtonLink></div>
      <section aria-labelledby="setup-later" className="order-6 space-y-1 pt-2">
        <h2 id="setup-later" className="text-h3 font-semibold">{t("setup.later")}</h2>
        <ul className="-mx-4">
          <li><ListRow href="/studio/customers/import" leading={<Upload aria-hidden size={18} className="text-text-secondary" />}
            title={t("setup.next.import")} meta={t("setup.next.importHint")} /></li>
          <li><ListRow href="/studio/more/booking-page" leading={<Palette aria-hidden size={18} className="text-text-secondary" />}
            title={t("setup.next.page")} meta={t("setup.next.pageHint")} /></li>
        </ul>
      </section>
    </div>
    <iframe src={home} title={t("setup.previewTitle")}
      className="setup-preview order-3 block w-full rounded-lg bg-surface ring-1 ring-hairline lg:sticky lg:top-8" />
  </div>;
}
