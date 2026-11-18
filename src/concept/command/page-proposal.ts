import type { DemoState } from "../data/types";
import { t } from "../i18n";
import type { PageConfig } from "../page/config";
import { changedAspects, type PageAspect } from "../page/diff";
import { designRequest } from "../page/design-request";
import { paletteIdOf } from "../page/theme";
import type { ChangeRow, Proposal } from "./proposal";

// "Make it calmer", "put reviews first", "use the colours from our logo": a
// proposal that edits the page config only, with a before/after preview. It
// applies as one `page/set` action, so the log can undo it.

const colourName = (page: PageConfig) => {
  const id = paletteIdOf(page.theme.colors);
  return id ? t(`page.palette.${id}`) : page.theme.colors ? t("page.palette.custom", { accent: page.theme.colors.accent }) : t("page.palette.default");
};

const sectionNames = (page: PageConfig) => page.sections.map((s) => t(`page.section.${s.kind}`)).join(", ") || t("pageEditor.none");

const SUMMARY: Partial<Record<PageAspect, (page: PageConfig) => string>> = {
  colours: colourName,
  fonts: (page) => t(`page.fonts.${page.theme.fonts}`),
  corners: (page) => t(`page.corners.${page.theme.corners}`),
  sections: sectionNames,
};

function rowsFor(before: PageConfig, after: PageConfig): ChangeRow[] {
  return changedAspects(before, after).flatMap((aspect) => {
    const summary = SUMMARY[aspect];
    return summary ? [{ label: t(`page.aspect.${aspect}`), before: summary(before), after: summary(after) }] : [];
  });
}

/** A proposal for a request about the booking page, or null when the text is about something else. */
export function pageProposal(state: DemoState, text: string): Proposal | null {
  const request = designRequest(text, state.page);
  if (!request) return null;
  if (request.kind === "needs-logo") return { kind: "message", text: t("page.proposal.needsLogo"), link: { href: "/studio/more/booking-page", label: t("page.proposal.openEditor") } };
  const rows = rowsFor(state.page, request.page);
  return {
    kind: "change",
    title: t("page.proposal.title"),
    subtitle: t("page.proposal.subtitle"),
    rows: rows.length ? rows : [{ label: t("page.aspect.sections"), after: sectionNames(request.page) }],
    action: { type: "page/set", page: request.page },
    toast: t("page.proposal.toast"),
    preview: { before: state.page, after: request.page },
  };
}
