import { PageRoot } from "../booking/page-root";
import { t } from "../i18n";
import type { PageConfig } from "../page/config";
import { cx } from "../ui/cx";
import type { Proposal } from "./proposal";

type Preview = NonNullable<Extract<Proposal, { kind: "change" }>["preview"]>;

/** A small stand-in for the booking page: colours, fonts, corners and the order of the sections. */
function Mini({ page, label }: { page: PageConfig; label: string }) {
  const sections = page.sections.filter((s) => s.kind !== "hero");
  const hero = page.sections.some((s) => s.kind === "hero");
  return (
    <figure className="min-w-0 space-y-1.5">
      <figcaption className="text-xs font-semibold uppercase tracking-wide text-eko-muted">{label}</figcaption>
      <PageRoot page={{ ...page, css: "" }} className="space-y-1.5 rounded-xl p-2 ring-1 ring-eko-line">
        {hero && (
          <div className="rounded-lg bg-eko-accent-soft p-2.5">
            <p className="text-sm font-semibold leading-tight">{t("page.preview.name")}</p>
            <p className="text-[11px] text-eko-muted">{t("page.preview.tagline")}</p>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 rounded-lg bg-eko-surface p-2 ring-1 ring-eko-line">
          <span className="text-[11px] font-medium">{t("booking.ask.title")}</span>
          <span className="rounded-md bg-eko-accent px-2 py-1 text-[10px] font-semibold text-eko-on-accent">{t("booking.book")}</span>
        </div>
        {sections.map((section, index) => (
          <div key={section.kind} className={cx("rounded-lg bg-eko-sunken px-2 py-1.5 text-[11px]", index > 3 && "hidden")}>
            {t(`page.section.${section.kind}`)}
          </div>
        ))}
      </PageRoot>
    </figure>
  );
}

/** Before and after side by side, so a design change can be judged before it is approved. */
export function PagePreview({ preview }: { preview: Preview }) {
  return (
    <div className="grid grid-cols-2 gap-3" aria-label={t("page.preview.label")} role="group">
      <Mini page={preview.before} label={t("page.preview.before")} />
      <Mini page={preview.after} label={t("page.preview.after")} />
    </div>
  );
}
