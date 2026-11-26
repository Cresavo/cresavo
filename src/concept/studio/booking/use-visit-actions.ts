import type { Booking } from "../../data/types";
import { moduleEnabled } from "../../modules/registry";
import { packageFor } from "../../packages/packages";
import { registerFor, useRegisterReceipts } from "../../register/ledger";
import { useStudio } from "../use-studio";
import { visitActions } from "./visit-actions";

/** The actions each visit's sheet offers, for the sheet and for the calendar's "Show me" tags alike. */
export function useVisitActions() {
  const { state, today, minutes, target } = useStudio();
  const receipts = useRegisterReceipts(target);
  const register = registerFor(target).info.kind !== "unavailable";
  const packages = moduleEnabled(state.modules, "packages");
  return (booking: Booking) => visitActions(booking, {
    today, minutes, register,
    paid: receipts.some((receipt) => receipt.reference === booking.id),
    inPackage: packages && !!packageFor(state, booking),
  });
}
