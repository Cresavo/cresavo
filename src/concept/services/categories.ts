import type { ServiceCategory } from "../data/types";
import { t } from "../i18n";
import type { Pack } from "../packs/types";

/** The price list headings a business starts with: its industry pack's two, which the owner can rename, reorder or add to. */
export function startCategories(pack: Pick<Pack, "categories">): ServiceCategory[] {
  return pack.categories.map((id) => ({ id, name: t(`category.${id}`) }));
}
