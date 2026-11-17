"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DRAFT_MESSAGE, READY_MESSAGE } from "../../booking/page-context";
import { bookingHome } from "../../booking/links";
import { t } from "../../i18n";
import type { PageConfig } from "../../page/config";
import { cx } from "../../ui/cx";
import { Segmented } from "../../ui/controls";

/**
 * The real booking page in a frame, wearing the draft. The editor sends the
 * draft by postMessage to its own origin; nothing is saved until the owner
 * presses Save.
 */
export function Preview({ page, slug }: { page: PageConfig; slug: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<"phone" | "wide">("phone");
  const send = useCallback(() => frame.current?.contentWindow?.postMessage({ type: DRAFT_MESSAGE, page }, window.location.origin), [page]);
  useEffect(send, [send]);
  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === READY_MESSAGE) send();
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, [send]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-eko-muted">{t("pageEditor.preview")}</h2>
        <Segmented
          label={t("pageEditor.device")}
          value={device}
          onChange={setDevice}
          options={[
            { value: "phone", label: t("pageEditor.device.phone") },
            { value: "wide", label: t("pageEditor.device.wide") },
          ]}
        />
      </div>
      <div className="flex justify-center rounded-2xl bg-eko-sunken p-2 sm:p-3">
        <iframe
          ref={frame}
          title={t("pageEditor.previewTitle")}
          src={`${bookingHome(slug)}?preview=1`}
          onLoad={send}
          className={cx("h-[34rem] max-w-full rounded-xl bg-eko-surface ring-1 ring-eko-line lg:h-[calc(100dvh-14rem)] lg:min-h-[34rem]", device === "phone" ? "w-[390px]" : "w-full")}
        />
      </div>
    </div>
  );
}
