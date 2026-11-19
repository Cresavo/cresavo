import type { DemoState } from "../data/types";
import { checkOwnSlug } from "./address";
import { normalizePage, type PageConfig } from "./config";
import { advanceStatus, checkDomain, type DomainStatus } from "./domain";

// Store actions for the booking page's address and design. The reducer
// re-checks everything, so a proposal from the assistant or a hand-edited
// state can never put an unchecked value on the page.

export type PageAction =
  | { type: "page/set"; page: PageConfig }
  | { type: "salon/slug"; slug: string }
  | { type: "domain/connect"; host: string; status?: DomainStatus }
  /** One more check of the DNS record. The live module passes the status it found; the demo moves one step on. */
  | { type: "domain/check"; host?: string; status?: DomainStatus }
  | { type: "domain/remove"; host?: string };

export function applyPageAction(state: DemoState, action: PageAction): DemoState {
  switch (action.type) {
    case "page/set": {
      const page = normalizePage(action.page);
      return JSON.stringify(page) === JSON.stringify(state.page) ? state : { ...state, page };
    }
    case "salon/slug": {
      const check = checkOwnSlug(action.slug, state.salon.slug, !!state.industry);
      return check.ok && check.slug !== state.salon.slug ? { ...state, salon: { ...state.salon, slug: check.slug } } : state;
    }
    case "domain/connect": {
      const check = checkDomain(action.host);
      if (!state.modules.domain || !check.ok || state.domain?.host === check.host) return state;
      return { ...state, domain: { host: check.host, status: action.status ?? "waiting-dns" } };
    }
    case "domain/check": {
      if (!state.domain || (action.host && state.domain.host !== action.host)) return state;
      const status = action.status ?? advanceStatus(state.domain.status);
      return status === state.domain.status ? state : { ...state, domain: { ...state.domain, status } };
    }
    case "domain/remove":
      return state.domain && (!action.host || state.domain.host === action.host) ? { ...state, domain: null } : state;
  }
}
