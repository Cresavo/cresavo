import type { DemoState, PackId } from "../data/types";
import { clinic } from "./clinic";
import { footMassage } from "./foot-massage";
import { hair } from "./hair";
import { nails } from "./nails";
import { trainer } from "./trainer";
import type { Pack } from "./types";

export const PACKS: Pack[] = [footMassage, hair, nails, trainer, clinic];
export const DEFAULT_PACK: PackId = "foot-massage";

export function getPack(id: PackId): Pack {
  return PACKS.find((pack) => pack.id === id) ?? footMassage;
}

export function packOf(state: Pick<DemoState, "pack">): Pack {
  return getPack(state.pack);
}

export type { Pack } from "./types";
