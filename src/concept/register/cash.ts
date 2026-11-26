import { minorDigits } from "../connections/core";

/** A typed amount ("500", "499,50", "1 000.5") as exact minor units, or null when it is not an amount. No floating point. */
export function minorFromInput(text: string, currency: string): number | null {
  const digits = minorDigits(currency);
  const match = text.replace(/[\s ]/g, "").match(/^(\d{1,9})(?:[.,](\d*))?$/);
  if (!match || (match[2]?.length ?? 0) > digits) return null;
  const fraction = (match[2] ?? "").padEnd(digits, "0");
  return Number(match[1]) * 10 ** digits + (digits ? Number(fraction) : 0);
}
