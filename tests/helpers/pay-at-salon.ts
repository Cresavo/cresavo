import type { DemoState } from "@/concept/data/types";

/** The salon with every treatment paid at the salon: for tests of online booking that are not about paying when booking. */
export const payAtSalon = <T extends Pick<DemoState, "cancellationPolicy">>(state: T): T =>
  ({ ...state, cancellationPolicy: { ...state.cancellationPolicy, payAtSalonDefault: true } });
