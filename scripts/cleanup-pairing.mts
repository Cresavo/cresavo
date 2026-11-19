import { pairingDb, sweep } from "../src/concept/pairing/db";
const db = pairingDb();
try {
  await db.$transaction(tx => sweep(tx));
} finally {
  await db.$disconnect();
}
