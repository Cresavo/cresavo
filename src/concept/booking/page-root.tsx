import type { CSSProperties, ReactNode } from "react";
import { pageCss, type PageConfig } from "../page/config";
import { themeVariables } from "../page/theme";
import { cx } from "../ui/cx";

/** The element every themed rule hangs on: colours, fonts and corners as variables, the owner's CSS scoped under it. */
export function PageRoot({ page, className, children }: { page: PageConfig; className?: string; children: ReactNode }) {
  const css = pageCss(page);
  return (
    <div className={cx("booking-theme", className)} data-corners={page.theme.corners} style={themeVariables(page.theme) as CSSProperties}>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {children}
    </div>
  );
}
