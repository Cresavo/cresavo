import { createHash } from "node:crypto";

/** Google event ids must match ^[0-9a-v]{5,1024}$; lowercase hex is inside that alphabet. Same booking, same id, so a retried insert answers 409. */
export const googleEventId = (ownId: string) => `bk${createHash("sha256").update(ownId).digest("hex").slice(0, 40)}`;

/** Graph transactionId for idempotent creates. */
export const graphTransactionId = (ownId: string) => createHash("sha256").update(`graph:${ownId}`).digest("hex").slice(0, 36);
