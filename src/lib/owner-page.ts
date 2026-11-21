import { cookies } from "next/headers";
import { db } from "./db";
import { ownerFromCookie, OWNER_COOKIE } from "./owner-session";

/** The signed-in owner on a server-rendered page, or null. */
export async function currentOwner() {
  return ownerFromCookie((await cookies()).get(OWNER_COOKIE)?.value);
}

/** The salon's name from its stored document. */
export async function ownerSalonName(tenantId: string): Promise<string> {
  const row = await db.tenantState.findUnique({ where: { tenantId }, select: { doc: true } });
  const name = (row?.doc as { salon?: { name?: unknown } } | undefined)?.salon?.name;
  return typeof name === "string" ? name : "";
}
