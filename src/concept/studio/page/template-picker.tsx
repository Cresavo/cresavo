"use client";

import { themeAttributes } from "../../booking/page-root";
import { t } from "../../i18n";
import { DEFAULT_PAGE, type PageConfig } from "../../page/config";
import { applyTemplate, TEMPLATE_IDS, templateIdOf, type TemplateId } from "../../page/templates";
import { cx } from "../../ui/cx";

interface Props {
  page: PageConfig;
  onPick: (id: TemplateId) => void;
}

/** The ready-made designs as small swatches in their own colours and fonts. Picking one changes the draft; the preview shows the real page. */
export function TemplatePicker({ page, onPick }: Props) {
  const current = templateIdOf(page);
  return (
    <div className="space-y-3">
      <p className="text-xs text-text-secondary">{t("pageEditor.templates.hint")}</p>
      <ul className="grid grid-cols-2 gap-3">
        {TEMPLATE_IDS.map((id) => {
          const name = t(`page.template.${id}.name`);
          const { className, ...theme } = themeAttributes(applyTemplate(DEFAULT_PAGE, id).theme);
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={current === id}
                onClick={() => onPick(id)}
                className={cx("ui-press block h-full w-full overflow-hidden rounded-md bg-surface text-left ring-1 ring-inset", current === id ? "ring-2 ring-action" : "ring-hairline hover:bg-surface-2")}
              >
                <span {...theme} className={cx(className, "flex min-h-20 items-end justify-between gap-2 p-3")}>
                  <span className="studio-template-name text-h2 font-semibold leading-none">{name}</span>
                  <span className="rounded-sm bg-action px-2 py-1 text-xs font-semibold text-on-action">{t("booking.book")}</span>
                </span>
                <span className="block p-3 text-xs text-text-secondary">{t(`page.template.${id}.text`)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
