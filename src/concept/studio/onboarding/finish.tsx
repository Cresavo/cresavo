"use client";

import Link from "next/link";
import { useState, type ReactNode, type Ref } from "react";
import type { Locale } from "@/lib/locale";
import { CalendarCheck, Check, Copy, Palette, Upload } from "lucide-react";
import { bookingHome } from "../../booking/links";
import { bookingShare } from "../../booking/share";
import { t } from "../../i18n";
import { Button, ButtonLink, buttonClass } from "../../ui/button";
import { Input } from "../../ui/controls";
import { ListRow } from "../../ui/list-row";
import { showToast } from "../../ui/toast";
import { PageHeader } from "../page-header";
import { useStudio } from "../use-studio";
import { recordShare } from "./booking-link";
import { recordPageSeen } from "./checklist";

/**
 * The finished salon: its real booking page, the link to share, one way on (the day) and a few things that can wait.
 * The preview is the booking page itself in a frame, so what the owner sees is what customers get.
 */
export function SetupFinish({ progress, titleRef }: { progress: ReactNode; titleRef: Ref<HTMLHeadingElement> }) {
  const { state } = useStudio();
  const { slug, name } = state.salon;
  const home = bookingHome(slug);
  // One frame: under the title on a phone, beside everything from lg. The column is `contents` until then, so its
  // children and the frame share one flow and `order` places the frame.
  return <div className="flex flex-col gap-6 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-x-12">
    <div className="contents lg:block lg:space-y-6">
      <div className="order-1">{progress}</div>
      <div className="order-2 -mb-6"><PageHeader tools={false} titleRef={titleRef} title={t("setup.ready")} subtitle={t("setup.readyHint")} /></div>
      <div className="order-4"><ShareLink slug={slug} name={name} language={state.localization.language} /></div>
      <div className="order-5"><ButtonLink href="/studio" size="lg" width="responsive">{t("setup.goToDay")}</ButtonLink></div>
      <section aria-labelledby="setup-later" className="order-6 space-y-1 pt-2">
        <h2 id="setup-later" className="text-h3 font-semibold">{t("setup.later")}</h2>
        <ul className="-mx-4">
          <li><ListRow href="/studio/customers/import" leading={<Upload aria-hidden size={18} className="text-text-secondary" />}
            title={t("setup.next.import")} meta={t("setup.next.importHint")} /></li>
          <li><ListRow href={home + "#book"} leading={<CalendarCheck aria-hidden size={18} className="text-text-secondary" />}
            title={t("setup.testBooking")} meta={t("setup.next.testHint")} /></li>
          <li><ListRow href="/studio/more/booking-page" leading={<Palette aria-hidden size={18} className="text-text-secondary" />}
            title={t("setup.next.page")} meta={t("setup.next.pageHint")} /></li>
        </ul>
      </section>
    </div>
    <iframe src={home} title={t("setup.previewTitle")}
      className="setup-preview order-3 block w-full rounded-lg bg-surface ring-1 ring-hairline lg:sticky lg:top-8" />
  </div>;
}

function ShareLink({ slug, name, language }: { slug: string; name: string; language: Locale }) {
  const [copied, setCopied] = useState(false);
  const { link } = bookingShare(window.location.origin, slug, name, language);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      recordShare(slug);
    } catch {
      showToast(t("share.failed"));
    }
  };
  return <div className="space-y-2">
    <label className="block text-body font-medium" htmlFor="setup-booking-link">{t("setup.link")}</label>
    <div className="flex flex-wrap gap-2">
      <Input id="setup-booking-link" readOnly value={link} onFocus={event => event.target.select()} className="min-w-0 flex-1 basis-56" />
      <Button variant="secondary" icon={copied ? <Check size={18} /> : <Copy size={18} />} onClick={copy}>{t(copied ? "common.copied" : "share.copyLink")}</Button>
    </div>
    {/* Opening the page from here counts as having checked it. */}
    <Link href={bookingHome(slug)} onClick={() => recordPageSeen(slug)} className={buttonClass("link", "md", "-ml-1 px-1")}>{t("setup.seePage")}</Link>
  </div>;
}
