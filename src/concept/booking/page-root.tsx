import type { CSSProperties, ReactNode } from "react";
import { pageCss, type PageConfig } from "../page/config";
import "./tenant-theme.css";
import { themeVariables, type PageTheme } from "../page/theme";
import { cx } from "../ui/cx";

/**
 * What makes an element wear a theme: the tenant scope and the theme's colours, fonts and corners.
 * A palette fixes the colour scheme; it goes in an attribute because the tokens' light-dark() is compiled to switches
 * that only CSS rules can set.
 */
export function themeAttributes(theme: PageTheme) {
  const { colorScheme, ...vars } = themeVariables(theme);
  return { className: "booking-theme", "data-corners": theme.corners, "data-scheme": colorScheme, style: vars as CSSProperties };
}

/** The element every themed rule hangs on: colours, fonts and corners as variables, the owner's CSS scoped under it. */
export function PageRoot({ page, className, children }: { page: PageConfig; className?: string; children: ReactNode }) {
  const css = pageCss(page);
  const { className: themed, ...attributes } = themeAttributes(page.theme);
  return (
    <div className={cx(themed, className)} {...attributes}>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {children}
    </div>
  );
}
