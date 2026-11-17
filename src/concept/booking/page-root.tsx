import type { CSSProperties, ReactNode } from "react";
import { pageCss, type PageConfig } from "../page/config";
import "./tenant-theme.css";
import { themeVariables } from "../page/theme";
import { cx } from "../ui/cx";

/** The element every themed rule hangs on: colours, fonts and corners as variables, the owner's CSS scoped under it. */
export function PageRoot({ page, className, children }: { page: PageConfig; className?: string; children: ReactNode }) {
  const css = pageCss(page);
  // A palette fixes the colour scheme; it goes in an attribute because the
  // tokens' light-dark() is compiled to switches that only CSS rules can set.
  const { colorScheme, ...vars } = themeVariables(page.theme);
  return (
    <div className={cx("booking-theme", className)} data-corners={page.theme.corners} data-scheme={colorScheme} style={vars as CSSProperties}>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {children}
    </div>
  );
}
